const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to check if time windows overlap (within 30 minutes)
function timeWindowsOverlap(timeStart1, timeEnd1, timeStart2, timeEnd2) {
  const start1 = new Date(timeStart1).getTime();
  const end1 = new Date(timeEnd1).getTime();
  const start2 = new Date(timeStart2).getTime();
  const end2 = new Date(timeEnd2).getTime();

  // Check if time windows are within 30 minutes of each other
  const diff = Math.abs(start1 - start2);
  return diff <= 30 * 60 * 1000; // 30 minutes in milliseconds
}

// Helper function to check route direction similarity (simplified)
function checkRouteSimilarity(polyline1, polyline2) {
  // For MVP, we'll use a simple check - in production, decode polylines and check overlap
  // This is a simplified version - you might want to use a proper polyline decoder
  if (!polyline1 || !polyline2) return false;
  
  // Basic check: if both have polylines, assume they're similar for MVP
  // In production, decode and compare actual route segments
  return polyline1.length > 0 && polyline2.length > 0;
}

// Helper function to extract keywords and pincode from address text
function extractKeywords(text) {
  if (!text) return { keywords: [], pincode: null };
  
  // Extract pincode (6-digit number, typically Indian pincode format)
  const pincodeMatch = text.match(/\b\d{6}\b/);
  const pincode = pincodeMatch ? pincodeMatch[0] : null;
  
  // Convert to lowercase and split by common separators
  const words = text.toLowerCase()
    .replace(/[,#]/g, ' ')
    .replace(/\b\d{6}\b/g, '') // Remove pincode from keywords
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter out short words
  
  return {
    keywords: words,
    pincode: pincode
  };
}

// Helper function to check keyword similarity between addresses
function checkKeywordMatch(text1, text2, checkPincode = false) {
  if (!text1 || !text2) return { match: false, score: 0, pincodeMatch: false };
  
  const extracted1 = extractKeywords(text1);
  const extracted2 = extractKeywords(text2);
  
  const keywords1 = extracted1.keywords;
  const keywords2 = extracted2.keywords;
  const pincode1 = extracted1.pincode;
  const pincode2 = extracted2.pincode;
  
  // Check pincode match (if enabled and both have pincodes)
  const pincodeMatch = checkPincode && pincode1 && pincode2 && pincode1 === pincode2;
  
  if (keywords1.length === 0 || keywords2.length === 0) {
    // If no keywords but pincode matches, still return a match
    if (pincodeMatch) {
      return { match: true, score: 100, commonKeywords: [], pincodeMatch: true };
    }
    return { match: false, score: 0, pincodeMatch: false };
  }
  
  // Find common keywords
  const commonKeywords = keywords1.filter(kw => keywords2.includes(kw));
  const totalKeywords = Math.max(keywords1.length, keywords2.length);
  let similarityScore = (commonKeywords.length / totalKeywords) * 100;
  
  // Boost score if pincode matches
  if (pincodeMatch) {
    similarityScore = Math.min(100, similarityScore + 30); // Add 30% boost for pincode match
  }
  
  // Consider it a match if:
  // - At least 30% keywords match OR
  // - 2+ common keywords OR
  // - Pincode matches (for pickup locations)
  const isMatch = similarityScore >= 30 || commonKeywords.length >= 2 || pincodeMatch;
  
  return {
    match: isMatch,
    score: similarityScore,
    commonKeywords: commonKeywords,
    pincodeMatch: pincodeMatch || false
  };
}

// Cloud Function to find matches for a ride request
exports.findMatches = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { rideRequestId } = data;
  if (!rideRequestId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideRequestId is required');
  }

  try {
    // Get the user's ride request
    const rideRequestDoc = await db.collection('ride_requests').doc(rideRequestId).get();
    if (!rideRequestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride request not found');
    }

    const userRideRequest = rideRequestDoc.data();
    const userId = context.auth.uid;

    // Verify the ride request belongs to the user
    if (userRideRequest.userId !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Not authorized');
    }

    // Get all active ride requests except the user's own
    const allRideRequests = await db.collection('ride_requests')
      .where('status', '==', 'active')
      .get();

    const matches = [];

    for (const doc of allRideRequests.docs) {
      const otherRideRequest = doc.data();
      const otherRideRequestId = doc.id;

      // Skip own request
      if (otherRideRequest.userId === userId) {
        continue;
      }

      // Check matching criteria
      let compatibilityScore = 0;
      let passedChecks = 0;
      const totalChecks = 6; // Increased to include keyword matching

      // 1. Check pickup location within 3-5 km radius
      const distance = calculateDistance(
        userRideRequest.pickupLatLng.lat,
        userRideRequest.pickupLatLng.lng,
        otherRideRequest.pickupLatLng.lat,
        otherRideRequest.pickupLatLng.lng
      );

      if (distance <= 5) {
        compatibilityScore += 20;
        passedChecks++;
      } else if (distance <= 10) {
        compatibilityScore += 10; // Partial score for slightly farther
      }

      // 2. Check keyword matching for pickup location (including pincode)
      const pickupKeywordMatch = checkKeywordMatch(
        userRideRequest.pickupText,
        otherRideRequest.pickupText,
        true // Enable pincode matching for pickup locations
      );
      if (pickupKeywordMatch.match) {
        compatibilityScore += 15;
        passedChecks++;
        // Bonus points if pincode matches
        if (pickupKeywordMatch.pincodeMatch) {
          compatibilityScore += 5; // Extra 5 points for pincode match
        }
      } else if (pickupKeywordMatch.score > 20) {
        compatibilityScore += 5; // Partial score for some keyword overlap
      }

      // 3. Check keyword matching for drop location
      const dropKeywordMatch = checkKeywordMatch(
        userRideRequest.dropText,
        otherRideRequest.dropText
      );
      if (dropKeywordMatch.match) {
        compatibilityScore += 20; // Higher weight for destination match
        passedChecks++;
      } else if (dropKeywordMatch.score > 20) {
        compatibilityScore += 10; // Partial score for some keyword overlap
      }

      // 4. Check route direction similarity (polyline overlap)
      if (checkRouteSimilarity(userRideRequest.polyline, otherRideRequest.polyline)) {
        compatibilityScore += 15;
        passedChecks++;
      }

      // 5. Check time window overlap (within 30 minutes)
      if (timeWindowsOverlap(
        userRideRequest.timeStart,
        userRideRequest.timeEnd,
        otherRideRequest.timeStart,
        otherRideRequest.timeEnd
      )) {
        compatibilityScore += 15;
        passedChecks++;
      }

      // 6. Check gender preference
      const userGenderPreference = userRideRequest.genderPreference || 'any';
      const otherUserGender = otherRideRequest.genderPreference || 'any';
      
      if (userGenderPreference === 'any' || 
          otherUserGender === 'any' || 
          userGenderPreference === otherUserGender) {
        compatibilityScore += 15;
        passedChecks++;
      }

      // Include matches with at least 2 passed checks OR score >= 40
      // This allows keyword-based matches even if distance is slightly farther
      if ((passedChecks >= 2 || compatibilityScore >= 40) && compatibilityScore >= 30) {
        // Get other user's profile
        const otherUserDoc = await db.collection('users').doc(otherRideRequest.userId).get();
        const otherUser = otherUserDoc.exists ? otherUserDoc.data() : {};

        matches.push({
          userId: otherRideRequest.userId,
          rideRequestId: otherRideRequestId,
          name: otherUser.name || 'User',
          gender: otherUser.gender || 'N/A',
          age: otherUser.age || null,
          phone: otherUser.phone || 'Not provided',
          photoUrl: otherUser.photoUrl || null,
          pickupText: otherRideRequest.pickupText,
          dropText: otherRideRequest.dropText,
          timeStart: otherRideRequest.timeStart,
          timeEnd: otherRideRequest.timeEnd,
          compatibilityScore: Math.round(compatibilityScore),
          distance: Math.round(distance * 10) / 10
        });
      }
    }

    // Sort by compatibility score (highest first)
    matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    return {
      success: true,
      matches: matches
    };
  } catch (error) {
    console.error('Error finding matches:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Real-time matching: Trigger when a new ride request is created
exports.onRideRequestCreated = functions.firestore
  .document('ride_requests/{requestId}')
  .onCreate(async (snap, context) => {
    const newRequest = snap.data();
    const newRequestId = context.params.requestId;

    // Only process active requests
    if (newRequest.status !== 'active') {
      return null;
    }

    console.log('New ride request created:', newRequestId);

    try {
      // Get all other active ride requests
      const allRequestsSnapshot = await db.collection('ride_requests')
        .where('status', '==', 'active')
        .get();

      const matches = [];

      for (const doc of allRequestsSnapshot.docs) {
        const otherRequest = doc.data();
        const otherRequestId = doc.id;

        // Skip own request
        if (otherRequestId === newRequestId || otherRequest.userId === newRequest.userId) {
          continue;
        }

        // Use the same matching logic
        let compatibilityScore = 0;
        let passedChecks = 0;

        // 1. Distance check
        const distance = calculateDistance(
          newRequest.pickupLatLng.lat,
          newRequest.pickupLatLng.lng,
          otherRequest.pickupLatLng.lat,
          otherRequest.pickupLatLng.lng
        );

        if (distance <= 5) {
          compatibilityScore += 20;
          passedChecks++;
        } else if (distance <= 10) {
          compatibilityScore += 10;
        }

        // 2. Pickup keyword match (including pincode)
        const pickupKeywordMatch = checkKeywordMatch(
          newRequest.pickupText,
          otherRequest.pickupText,
          true // Enable pincode matching for pickup locations
        );
        if (pickupKeywordMatch.match) {
          compatibilityScore += 15;
          passedChecks++;
          // Bonus points if pincode matches
          if (pickupKeywordMatch.pincodeMatch) {
            compatibilityScore += 5; // Extra 5 points for pincode match
          }
        } else if (pickupKeywordMatch.score > 20) {
          compatibilityScore += 5;
        }

        // 3. Drop keyword match (most important)
        const dropKeywordMatch = checkKeywordMatch(
          newRequest.dropText,
          otherRequest.dropText
        );
        if (dropKeywordMatch.match) {
          compatibilityScore += 20;
          passedChecks++;
        } else if (dropKeywordMatch.score > 20) {
          compatibilityScore += 10;
        }

        // 4. Route similarity
        if (checkRouteSimilarity(newRequest.polyline, otherRequest.polyline)) {
          compatibilityScore += 15;
          passedChecks++;
        }

        // 5. Time window
        if (timeWindowsOverlap(
          newRequest.timeStart,
          newRequest.timeEnd,
          otherRequest.timeStart,
          otherRequest.timeEnd
        )) {
          compatibilityScore += 15;
          passedChecks++;
        }

        // 6. Gender preference
        const userGenderPreference = newRequest.genderPreference || 'any';
        const otherUserGender = otherRequest.genderPreference || 'any';
        
        if (userGenderPreference === 'any' || 
            otherUserGender === 'any' || 
            userGenderPreference === otherUserGender) {
          compatibilityScore += 15;
          passedChecks++;
        }

        // If it's a match, create potential match records for both users
        if ((passedChecks >= 2 || compatibilityScore >= 40) && compatibilityScore >= 30) {
          // Get user profiles
          const newUserDoc = await db.collection('users').doc(newRequest.userId).get();
          const otherUserDoc = await db.collection('users').doc(otherRequest.userId).get();
          
          const newUser = newUserDoc.exists ? newUserDoc.data() : {};
          const otherUser = otherUserDoc.exists ? otherUserDoc.data() : {};

          // Create match record for the new request user (they see the other user)
          await db.collection('potential_matches').add({
            userId: newRequest.userId,
            rideRequestId: newRequestId,
            matchedUserId: otherRequest.userId,
            matchedRideRequestId: otherRequestId,
            matchedUserName: otherUser.name || 'User',
            matchedUserGender: otherUser.gender || 'N/A',
            matchedUserAge: otherUser.age || null,
            matchedUserPhone: otherUser.phone || 'Not provided',
            matchedUserPhotoUrl: otherUser.photoUrl || null,
            pickupText: otherRequest.pickupText,
            dropText: otherRequest.dropText,
            timeStart: otherRequest.timeStart,
            timeEnd: otherRequest.timeEnd,
            compatibilityScore: Math.round(compatibilityScore),
            distance: Math.round(distance * 10) / 10,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'new' // 'new', 'viewed', 'sent'
          });

          // Create match record for the existing request user (they see the new user)
          await db.collection('potential_matches').add({
            userId: otherRequest.userId,
            rideRequestId: otherRequestId,
            matchedUserId: newRequest.userId,
            matchedRideRequestId: newRequestId,
            matchedUserName: newUser.name || 'User',
            matchedUserGender: newUser.gender || 'N/A',
            matchedUserAge: newUser.age || null,
            matchedUserPhone: newUser.phone || 'Not provided',
            matchedUserPhotoUrl: newUser.photoUrl || null,
            pickupText: newRequest.pickupText,
            dropText: newRequest.dropText,
            timeStart: newRequest.timeStart,
            timeEnd: newRequest.timeEnd,
            compatibilityScore: Math.round(compatibilityScore),
            distance: Math.round(distance * 10) / 10,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'new'
          });

          console.log(`Match found between ${newRequest.userId} and ${otherRequest.userId}`);
        }
      }

      return null;
    } catch (error) {
      console.error('Error in real-time matching:', error);
      return null;
    }
  });

// Cloud Function to handle mutual match acceptance
exports.handleMatchAcceptance = functions.firestore
  .document('matches/{matchId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const matchId = context.params.matchId;

    // Check if status changed to "accepted"
    if (before.status !== 'accepted' && after.status === 'accepted') {
      // Check if both users have accepted
      const matchDoc = await db.collection('matches').doc(matchId).get();
      const matchData = matchDoc.data();

      // This is a simplified version - in production, you'd need to track
      // which user accepted and ensure both have accepted
      // For now, we'll update status to "mutual" when both accept
      
      // You might want to add a field like "acceptedBy" array to track who accepted
      // For MVP, we'll assume if status is "accepted", both have accepted
      
      await db.collection('matches').doc(matchId).update({
        status: 'mutual',
        mutualMatchAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Here you could send FCM notifications to both users
      // For MVP, we'll skip this but leave the structure
    }

    return null;
  });

