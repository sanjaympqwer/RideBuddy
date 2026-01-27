const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Ride request expiry configuration (30 minutes)
const REQUEST_EXPIRY_MS = 30 * 60 * 1000;

// Helper to check if a ride request is older than the expiry window
function isRequestExpired(request) {
  try {
    if (!request || !request.createdAt) return false;
    const createdAtMs = new Date(request.createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return false;
    return Date.now() - createdAtMs > REQUEST_EXPIRY_MS;
  } catch (e) {
    console.error('[isRequestExpired] Failed to parse createdAt:', request && request.createdAt, e);
    return false;
  }
}

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
  try {
    const start1 = new Date(timeStart1).getTime();
    const end1 = new Date(timeEnd1).getTime();
    const start2 = new Date(timeStart2).getTime();
    const end2 = new Date(timeEnd2).getTime();

    // Check if time windows are within 30 minutes of each other
    // Compare start times (most important)
    const diff = Math.abs(start1 - start2);
    const overlap = diff <= 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Also check if the windows actually overlap
    const windowsOverlap = !(end1 < start2 || end2 < start1);
    
    return overlap || windowsOverlap;
  } catch (error) {
    console.error('Error in timeWindowsOverlap:', error);
    // If there's an error parsing dates, be lenient and return true
    return true;
  }
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
  
  // Find common keywords (exact match)
  const commonKeywords = keywords1.filter(kw => keywords2.includes(kw));
  
  // Also check for substring matches (more lenient)
  const substringMatches = keywords1.filter(kw1 => 
    keywords2.some(kw2 => kw1.includes(kw2) || kw2.includes(kw1))
  );
  
  // Use the better of exact matches or substring matches
  const bestMatches = Math.max(commonKeywords.length, substringMatches.length);
  const totalKeywords = Math.max(keywords1.length, keywords2.length);
  let similarityScore = totalKeywords > 0 ? (bestMatches / totalKeywords) * 100 : 0;
  
  // Boost score if pincode matches
  if (pincodeMatch) {
    similarityScore = Math.min(100, similarityScore + 30); // Add 30% boost for pincode match
  }
  
  // Also check if addresses are very similar (normalized comparison)
  const normalized1 = text1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalized2 = text2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check for exact match after normalization
  const exactTextMatch = normalized1 === normalized2;
  
  // Check if one address contains the other (for cases like "123 Main St" vs "123 Main Street")
  const containsMatch = normalized1.length > 10 && normalized2.length > 10 && 
                        (normalized1.includes(normalized2) || normalized2.includes(normalized1));
  
  // If addresses are very similar (normalized), consider it a strong match
  if (exactTextMatch) {
    return { match: true, score: 100, commonKeywords: [], pincodeMatch: pincodeMatch || false };
  }
  
  // If one contains the other and they're substantial, boost score significantly
  if (containsMatch) {
    similarityScore = Math.max(similarityScore, 80);
  }
  
  // Consider it a match if:
  // - Exact text match (normalized) OR
  // - Contains match (one address contains the other) OR
  // - At least 20% keywords match OR
  // - 1+ common keywords OR
  // - Pincode matches
  const isMatch = exactTextMatch || containsMatch || similarityScore >= 20 || bestMatches >= 1 || pincodeMatch;
  
  return {
    match: isMatch,
    score: similarityScore,
    commonKeywords: commonKeywords,
    pincodeMatch: pincodeMatch || false
  };
}

// Cloud Function to find matches for a ride request
exports.findMatches = functions.https.onCall(async (data, context) => {
  // Set CORS headers (though onCall should handle this automatically)
  // Verify authentication
  if (!context.auth) {
    console.error('[findMatches] Unauthenticated request');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  console.log('[findMatches] Request received from user:', context.auth.uid);

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

    // If this request itself is expired, mark it inactive and return no matches
    if (isRequestExpired(userRideRequest)) {
      console.log('[findMatches] User ride request is expired, marking inactive:', rideRequestId);
      try {
        await db.collection('ride_requests').doc(rideRequestId).update({
          status: 'inactive',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (e) {
        console.error('[findMatches] Failed to mark request inactive:', e);
      }
      return {
        success: true,
        matches: [],
        expired: true,
        message: 'Your ride request has expired. Please create a new one.'
      };
    }

    // Get all active ride requests except the user's own
    const allRideRequests = await db.collection('ride_requests')
      .where('status', '==', 'active')
      .get();

    console.log(`[findMatches] User ${userId} has request ${rideRequestId}`);
    console.log(`[findMatches] Found ${allRideRequests.docs.length} active ride requests total`);
    console.log(`[findMatches] User's request:`, {
      pickupText: userRideRequest.pickupText,
      dropText: userRideRequest.dropText,
      pickupLatLng: userRideRequest.pickupLatLng,
      dropLatLng: userRideRequest.dropLatLng,
      timeStart: userRideRequest.timeStart,
      timeEnd: userRideRequest.timeEnd
    });

    const matches = [];

    for (const doc of allRideRequests.docs) {
      const otherRideRequest = doc.data();
      const otherRideRequestId = doc.id;

      // Skip own request
      if (otherRideRequest.userId === userId) {
        continue;
      }

       // Skip expired requests
       if (isRequestExpired(otherRideRequest)) {
         console.log('[findMatches] Skipping expired request:', otherRideRequestId);
         continue;
       }

      // Validate required fields
      if (!otherRideRequest.pickupLatLng || !otherRideRequest.pickupText || 
          !otherRideRequest.dropLatLng || !otherRideRequest.dropText) {
        console.log(`[findMatches] Skipping request ${otherRideRequestId} - missing required fields`);
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

      // 3. Check keyword matching for drop location (including pincode)
      const dropKeywordMatch = checkKeywordMatch(
        userRideRequest.dropText,
        otherRideRequest.dropText,
        true // Enable pincode matching for drop locations too
      );
      if (dropKeywordMatch.match) {
        compatibilityScore += 20; // Higher weight for destination match
        passedChecks++;
        // Bonus points if pincode matches
        if (dropKeywordMatch.pincodeMatch) {
          compatibilityScore += 5; // Extra 5 points for pincode match
        }
      } else if (dropKeywordMatch.score > 20) {
        compatibilityScore += 10; // Partial score for some keyword overlap
      }
      
      // Special case: If both pickup AND drop match, it's definitely a match
      const bothLocationsMatch = pickupKeywordMatch.match && dropKeywordMatch.match;
      
      // If both locations match exactly, force a match regardless of other criteria
      if (bothLocationsMatch) {
        compatibilityScore = Math.max(compatibilityScore, 50); // Ensure minimum score
        passedChecks = Math.max(passedChecks, 2); // Ensure minimum checks
        console.log(`[findMatches] ⭐ Both locations match exactly - forcing match`);
      }

      // 4. Check route direction similarity (polyline overlap)
      // This is optional - don't penalize if polylines are missing
      if (userRideRequest.polyline && otherRideRequest.polyline) {
        if (checkRouteSimilarity(userRideRequest.polyline, otherRideRequest.polyline)) {
          compatibilityScore += 15;
          passedChecks++;
        }
      } else {
        // If polylines are missing but locations match, still give partial credit
        if (pickupKeywordMatch.match && dropKeywordMatch.match) {
          compatibilityScore += 10;
        }
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

      // Debug logging
      console.log(`[findMatches] Checking match for request ${otherRideRequestId}:`, {
        userId: otherRideRequest.userId,
        pickupText1: userRideRequest.pickupText,
        pickupText2: otherRideRequest.pickupText,
        dropText1: userRideRequest.dropText,
        dropText2: otherRideRequest.dropText,
        pickupMatch: pickupKeywordMatch.match,
        pickupScore: pickupKeywordMatch.score,
        dropMatch: dropKeywordMatch.match,
        dropScore: dropKeywordMatch.score,
        bothLocationsMatch: bothLocationsMatch,
        distance: distance,
        timeOverlap: timeWindowsOverlap(
          userRideRequest.timeStart,
          userRideRequest.timeEnd,
          otherRideRequest.timeStart,
          otherRideRequest.timeEnd
        ),
        compatibilityScore: compatibilityScore,
        passedChecks: passedChecks
      });

      // Include matches if:
      // - Both pickup AND drop locations match (exact match) - ALWAYS MATCH regardless of other criteria OR
      // - At least 2 passed checks AND score >= 20 OR
      // - Score >= 30
      // This allows keyword-based matches even if distance is slightly farther
      const isMatch = bothLocationsMatch || 
                     ((passedChecks >= 2 || compatibilityScore >= 30) && compatibilityScore >= 20);
      
      if (isMatch) {
        console.log(`[findMatches] ✓ MATCH FOUND: pickupMatch=${pickupKeywordMatch.match}, dropMatch=${dropKeywordMatch.match}, score=${compatibilityScore}, checks=${passedChecks}, distance=${distance}km`);
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

    console.log(`[findMatches] Total matches found: ${matches.length}`);
    if (matches.length === 0) {
      console.log(`[findMatches] ⚠️ No matches found. Check logs above for details.`);
    }

    return {
      success: true,
      matches: matches
    };
  } catch (error) {
    console.error('[findMatches] Error finding matches:', error);
    console.error('[findMatches] Error stack:', error.stack);
    
    // Return proper error format for Firebase callable functions
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'An error occurred while finding matches: ' + error.message);
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

      console.log(`[onRideRequestCreated] New request ${newRequestId} by user ${newRequest.userId}`);
      console.log(`[onRideRequestCreated] Found ${allRequestsSnapshot.docs.length} active ride requests total`);
      console.log(`[onRideRequestCreated] New request details:`, {
        pickupText: newRequest.pickupText,
        dropText: newRequest.dropText,
        pickupLatLng: newRequest.pickupLatLng,
        dropLatLng: newRequest.dropLatLng,
        timeStart: newRequest.timeStart,
        timeEnd: newRequest.timeEnd
      });

      const matches = [];

      for (const doc of allRequestsSnapshot.docs) {
        const otherRequest = doc.data();
        const otherRequestId = doc.id;

        // Skip own request
        if (otherRequestId === newRequestId || otherRequest.userId === newRequest.userId) {
          continue;
        }

        // Skip expired requests
        if (isRequestExpired(otherRequest)) {
          console.log('[onRideRequestCreated] Skipping expired request:', otherRequestId);
          continue;
        }

        // Validate required fields
        if (!otherRequest.pickupLatLng || !otherRequest.pickupText || 
            !otherRequest.dropLatLng || !otherRequest.dropText) {
          console.log(`[onRideRequestCreated] Skipping request ${otherRequestId} - missing required fields`);
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

        // 3. Drop keyword match (most important, including pincode)
        const dropKeywordMatch = checkKeywordMatch(
          newRequest.dropText,
          otherRequest.dropText,
          true // Enable pincode matching for drop locations too
        );
        if (dropKeywordMatch.match) {
          compatibilityScore += 20;
          passedChecks++;
          // Bonus points if pincode matches
          if (dropKeywordMatch.pincodeMatch) {
            compatibilityScore += 5; // Extra 5 points for pincode match
          }
        } else if (dropKeywordMatch.score > 20) {
          compatibilityScore += 10;
        }
        
        // Special case: If both pickup AND drop match, it's definitely a match
        const bothLocationsMatch = pickupKeywordMatch.match && dropKeywordMatch.match;
        
        // If both locations match exactly, force a match regardless of other criteria
        if (bothLocationsMatch) {
          compatibilityScore = Math.max(compatibilityScore, 50); // Ensure minimum score
          passedChecks = Math.max(passedChecks, 2); // Ensure minimum checks
          console.log(`[onRideRequestCreated] ⭐ Both locations match exactly - forcing match`);
        }

        // 4. Route similarity (optional - don't penalize if polylines are missing)
        if (newRequest.polyline && otherRequest.polyline) {
          if (checkRouteSimilarity(newRequest.polyline, otherRequest.polyline)) {
            compatibilityScore += 15;
            passedChecks++;
          }
        } else {
          // If polylines are missing but both locations match, still give partial credit
          if (pickupKeywordMatch.match && dropKeywordMatch.match) {
            compatibilityScore += 10;
          }
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

        // Debug logging
        console.log(`[onRideRequestCreated] Checking match for request ${otherRequestId}:`, {
          userId: otherRequest.userId,
          pickupText1: newRequest.pickupText,
          pickupText2: otherRequest.pickupText,
          dropText1: newRequest.dropText,
          dropText2: otherRequest.dropText,
          pickupMatch: pickupKeywordMatch.match,
          pickupScore: pickupKeywordMatch.score,
          dropMatch: dropKeywordMatch.match,
          dropScore: dropKeywordMatch.score,
          bothLocationsMatch: bothLocationsMatch,
          distance: distance,
          timeOverlap: timeWindowsOverlap(
            newRequest.timeStart,
            newRequest.timeEnd,
            otherRequest.timeStart,
            otherRequest.timeEnd
          ),
          compatibilityScore: compatibilityScore,
          passedChecks: passedChecks
        });

        // If it's a match, create potential match records for both users
        // Match if:
        // - Both pickup AND drop locations match (exact match) - ALWAYS MATCH regardless of other criteria OR
        // - At least 2 passed checks AND score >= 20 OR
        // - Score >= 30
        const isMatch = bothLocationsMatch || 
                       ((passedChecks >= 2 || compatibilityScore >= 30) && compatibilityScore >= 20);
        
        if (isMatch) {
          console.log(`[onRideRequestCreated] ✓ MATCH FOUND: pickupMatch=${pickupKeywordMatch.match}, dropMatch=${dropKeywordMatch.match}, score=${compatibilityScore}, checks=${passedChecks}, distance=${distance}km`);
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
        } else {
          console.log(`[onRideRequestCreated] ✗ No match: score=${compatibilityScore}, checks=${passedChecks}, bothLocationsMatch=${bothLocationsMatch}`);
        }
      }

      console.log(`[onRideRequestCreated] Processing complete. Total matches created: ${matches.length}`);

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

