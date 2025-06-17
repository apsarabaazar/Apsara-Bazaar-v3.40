// Global object to track current image indexes per post
let currentImageIndexes = {};
//Open Post Details
function loadpostdetails(id){
  document.getElementById('loading-overlay').style.display = 'flex';
  setTimeout(function() {
    window.location.href = `/post/comments/${id}`;
  }, 750);  // 100ms delay so the overlay appears
}

// SHARE POST
async function sharePost(postId) {
  const shareData = {
    title: "Check out this post on Apsara Bazaar!",
    text: "Here’s an interesting post I found:",
    url: `https://apsarabazaar.onrender.com/post/details/${postId}`,
  };

  // Attempt to share if the Web Share API is available
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      console.log("Post shared successfully.");
    } catch (err) {
      console.error("Sharing failed:", err);
    }
    // Always copy the URL to clipboard afterward
    copyToClipboard(shareData.url);
  } else {
    // Fallback: just copy the URL to clipboard
    copyToClipboard(shareData.url);
  }
}

// COPY TO CLIPBOARD (with Clipboard API fallback)
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard using Clipboard API.");
    } catch (err) {
      console.error("Failed to copy text using Clipboard API:", err);
    }
  } else {
    // Fallback method for older browsers
    const tempInput = document.createElement("input");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand("copy");
      console.log("Copied to clipboard using execCommand.");
    } catch (err) {
      console.error("execCommand copy failed:", err);
    }
    document.body.removeChild(tempInput);
  }
}

// REDIRECT TO PROFILE
function redirectToProfile(username) {
  document.getElementById("loading-overlay").style.display = "flex";
  setTimeout(function () {
    window.location.href = `/user/profile/${username}`;
  }, 750); // 100ms delay so the overlay appears
}

// Following and Unfollowing of Users
// async function FollowUser(username) {
//   // Check if the user is logged in
//   if (!isLoggedIn) {
//     window.location.href = "/auth/login";
//     return;
//   }

//   const followBtn = document.getElementById("follow-btn");
//   if (followBtn) {
//     // Optimistically update the UI
//     followBtn.innerText = "Following";
//   }

//   try {
//     const response = await fetch(`/user/follow/${username}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' }
//     });
//     const data = await response.json();

//     if (response.status === 200) {
//       // Follow successful; no further UI changes needed.
//     } else if (response.status === 401) {
//       window.location.href = "/auth/login";
//     } else if (response.status === 400) {
//       // Revert UI if follow failed (e.g., already following)
//       if (followBtn) followBtn.innerText = "Follow";
//       alert(data.message || 'You are already following.');
//     } else {
//       console.error('Unexpected error:', data);
//       if (followBtn) followBtn.innerText = "Follow";
//       alert('An error occurred while following the user.');
//     }
//   } catch (error) {
//     console.error('Error:', error);
//     if (followBtn) followBtn.innerText = "Follow";
//     alert('An error occurred while processing your request.');
//   }
// }

// async function UnfollowUser(username) {
//   if (!isLoggedIn) {
//     window.location.href = "/auth/login";
//     return;
//   }
//   let a = document.getElementById(`post-options-${postId}`);
//   a.style.display = "none";

//   const followBtn = document.getElementById("follow-btn");
//   if (followBtn) {
//     // Optimistically update the UI: change button text to "Follow"
//     followBtn.innerText = "Follow";
//   }

//   try {
//     const response = await fetch(`/user/unfollow/${username}`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' }
//     });
//     const data = await response.json();

//     if (response.status === 200) {
//       // Unfollow successful; UI is already updated.
//       if(document.getElementById("post-author-follow"))
//       {
//       document.getElementById("post-author-follow").style.display="block"
//       }
//     } else if (response.status === 401) {
//       window.location.href = "/auth/login";
//     } else if (response.status === 400) {
//       // Revert UI if unfollow failed (e.g., not currently following)
//       if (followBtn) followBtn.innerText = "Following";
//       alert(data.message || 'You are not following this user.');
//     } else {
//       console.error('Unexpected error:', data);
//       if (followBtn) followBtn.innerText = "Following";
//       alert('An error occurred while unfollowing the user.');
//     }
//   } catch (error) {
//     console.error('Error:', error);
//     if (followBtn) followBtn.innerText = "Following";
//     alert('An error occurred while processing your request.');
//   }
// }

async function toggleFollow(username) {
  
  if (!isLoggedIn) {
    window.location.href = "/auth/login";
    return;
  }

  const followBtn = document.getElementById("follow-btn");
  if (!followBtn) return;

  const isFollowing = followBtn.innerText === "Following" || followBtn.innerText === "Unfollow";
 
  const action = isFollowing ? "unfollow" : "follow";
  const originalText = followBtn.innerText;
  

  // Optimistic UI update
  followBtn.innerText = isFollowing ? "Follow" : "Following";
  try {
    console.log("sending")
    const response = await fetch(`/user/${action}/${username}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    const data = await response.json();


      if (response.status === 401) {
        window.location.href = "/auth/login";
      }
      else if(response.status===400){
      followBtn.innerText = originalText;
      alert(data.message || `Error trying to ${action}`);
      }

  } catch (error) {
    console.error("Error:", error);
    followBtn.innerText = originalText;
    alert("An error occurred while processing your request.");
  }
}
    







// FULLSCREEN IMAGE HANDLING

const fullScreenImageContainer = document.getElementById("fullScreenImageContainer");
const fullScreenImage          = document.getElementById("fullScreenImage");

// CONFIG
const MIN_SCALE         = 1;
const MAX_SCALE         = 5;
const WHEEL_SENSITIVITY = 0.001;
const PINCH_SENSITIVITY = 300;

// STATE
let scale     = 1;
let offsetX   = 0;
let offsetY   = 0;
let isPanning = false;
let lastX     = 0;
let lastY     = 0;

let pointers  = {};
let startDist = 0;

// UTIL
function clamp(v, min = MIN_SCALE, max = MAX_SCALE) {
  return Math.min(Math.max(min, v), max);
}
function applyTransform() {
  fullScreenImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

// DESKTOP: Ctrl + wheel to zoom
fullScreenImageContainer.addEventListener("wheel", e => {
  if (e.ctrlKey) {
    e.preventDefault();
    scale = clamp(scale - e.deltaY * WHEEL_SENSITIVITY);
    applyTransform();
  }
}, { passive: false });


// POINTER DOWN: track pointers & maybe start pan
fullScreenImageContainer.addEventListener("pointerdown", e => {
  pointers[e.pointerId] = e;

  // if already zoomed-in and only one pointer, start panning
  if (scale > 1 && Object.keys(pointers).length === 1) {
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
});

// POINTER MOVE: handle pan OR pinch
fullScreenImageContainer.addEventListener("pointermove", e => {
  if (!(e.pointerId in pointers)) return;
  pointers[e.pointerId] = e;

  const ids = Object.keys(pointers);

  // ——— PAN (single‐finger / mouse drag) ———
  if (isPanning && ids.length === 1) {
    e.preventDefault();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    // update & clamp offsets
    const maxX = (scale - 1) * fullScreenImage.clientWidth  / 2;
    const maxY = (scale - 1) * fullScreenImage.clientHeight / 2;
    offsetX = clamp(offsetX + dx, -maxX, maxX);
    offsetY = clamp(offsetY + dy, -maxY, maxY);

    applyTransform();
    return;
  }

  // ——— PINCH (two‐finger) ———
  if (ids.length === 2) {
    const [p1, p2] = ids.map(id => pointers[id]);
    const curDist = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);

    if (!startDist) startDist = curDist;
    e.preventDefault();

    const delta = (curDist - startDist) / PINCH_SENSITIVITY;
    scale = clamp(scale + delta);
    startDist = curDist;

    applyTransform();
  }
}, { passive: false });

// POINTER UP / CANCEL / LEAVE / OUT: cleanup pointers & state
function removePointer(id) {
  delete pointers[id];
  if (Object.keys(pointers).length < 2) startDist = 0;
  if (Object.keys(pointers).length === 0) isPanning = false;
}
["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach(evt => {
  fullScreenImageContainer.addEventListener(evt, e => removePointer(e.pointerId));
});


// YOUR ORIGINAL FUNCTIONS, now reset pan+zoom too:

function openFullscreenMedia(postId) {
  console.log("Trying")
  const imgElem = document.getElementById(`media-${postId}`);
  if (imgElem && fullScreenImage && fullScreenImageContainer) {
    fullScreenImage.src = imgElem.src;
    fullScreenImageContainer.style.display = "flex";

    // reset state
    scale     = 1;
    offsetX   = 0;
    offsetY   = 0;
    startDist = 0;
    pointers  = {};
    isPanning = false;
    fullScreenImage.style.transform = "";
  }
}

function closeFullscreenMedia() {
  console.log("Closing")
  if (fullScreenImageContainer) {
    fullScreenImageContainer.style.display = "none";
  }

  // reset state
  scale     = 1;
  offsetX   = 0;
  offsetY   = 0;
  startDist = 0;
  pointers  = {};
  isPanning = false;
  fullScreenImage.style.transform = "";
}

// (Optional) close on Escape key
fullScreenImageContainer.addEventListener("keydown", e => {
  if (e.key === "Escape") closeFullscreenMedia();
});


// IMAGE NAVIGATION

function showLoader(postId) {
  const imgElem = document.getElementById(`media-${postId}`);
  console.log("Trying to update loader")
  if (!imgElem) 
    {
      console.log("Didnt Found")
 
      return
    };

  imgElem.style.opacity = "0.5"; // Reduce opacity to indicate loading
}

function hideLoader(postId) {
  const imgElem = document.getElementById(`media-${postId}`);
  if (!imgElem) return;
  setTimeout(() => {
    imgElem.style.opacity = "1";  // Restore opacity when loaded
  }, 100);
 
}

function prevMedia(postId) {
  const imgElem = document.getElementById(`media-${postId}`);
  if (!imgElem) return;

  const imagesAttr = imgElem.getAttribute("data-media");
  if (!imagesAttr) return;

  let images;
  try {
    images = JSON.parse(imagesAttr);
  } catch (err) {
    console.error("Invalid JSON in data-images:", err);
    return;
  }

  currentImageIndexes[postId] = currentImageIndexes[postId] || 0;
  currentImageIndexes[postId] =
    currentImageIndexes[postId] > 0
      ? currentImageIndexes[postId] - 1
      : images.length - 1;

  showLoader(postId); // Show loader before loading new image

  const newImage = new Image();
  newImage.src = images[currentImageIndexes[postId]];
  newImage.onload = () => {
    imgElem.src = newImage.src;
    hideLoader(postId); // Hide loader when image is loaded
    updateImageCounter(postId, currentImageIndexes[postId], images.length);
  };
}

function nextMedia(postId) {
  console.log("Next Media here");
  const mediaElem = document.getElementById(`media-${postId}`);
  if (!mediaElem) return;

  const mediaAttr = mediaElem.getAttribute("data-media");
  if (!mediaAttr) return;
  console.log(mediaAttr);

  let mediaList;
  try {
    mediaList = JSON.parse(mediaAttr);
  } catch (err) {
    console.error("Invalid JSON in data-media:", err);
    return;
  }

  currentImageIndexes[postId] = currentImageIndexes[postId] || 0;
  currentImageIndexes[postId] =
    currentImageIndexes[postId] < mediaList.length - 1
      ? currentImageIndexes[postId] + 1
      : 0;

  const newSrc = mediaList[currentImageIndexes[postId]];
  showLoader(postId); // Show loader

  if (isVideoUrl(newSrc)) {
    // It's a video
    mediaElem.pause(); // stop current if any
    mediaElem.src = newSrc;
    mediaElem.load();
    mediaElem.onloadeddata = () => {
      hideLoader(postId);
      updateImageCounter(postId, currentImageIndexes[postId], mediaList.length);
    };
  } else {
    // It's an image
    const img = new Image();
    img.src = newSrc;
    img.onload = () => {
      mediaElem.src = img.src;
      hideLoader(postId);
      updateImageCounter(postId, currentImageIndexes[postId], mediaList.length);
    };
  }
}
function isVideoUrl(url) {
  return url.match(/\.(mp4|webm|ogg)$/i);
}


function updateImageCounter(postId, currentIndex, total) {
  const counterElem = document.getElementById(`media-counter-${postId}`);
  console.log("Trying to update image counter of : "+postId +"to"+currentIndex+1)
  if (counterElem) {
      counterElem.innerText = (currentIndex + 1) + " / " + total;
  }
}

 //Time Shower
 function timeAgo(isoDate) {
  const timeUnits = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hr", seconds: 3600 },
    { label: "minute", seconds: 60 }
  ];
  const now = new Date();
  const past = new Date(isoDate);
  const diffInSeconds = Math.floor((now - past) / 1000);
  for (let unit of timeUnits) {
    const interval = Math.floor(diffInSeconds / unit.seconds);
    if (interval >= 1) {
      return `${interval} ${unit.label}${interval > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

//Post Options

function ShowPostOptions(postId){
  let a=document.getElementById(`post-options-${postId}`)
  if(a.style.display==="none")
  {
    a.style.display="block";
  }
  else{
    a.style.display="none"
  }
}

async function SavePost(postId) {
   // Check if the user is logged in
   if (!isLoggedIn) {
    window.location.href = "/auth/login";
    return;
  }

  let a = document.getElementById(`post-options-${postId}`);
  a.style.display = "none";

  fetch(`/post/save/${postId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
    .then(response =>
      response.json().then(data => ({ status: response.status, body: data }))
    )
    .then(({ status, body }) => {
      const saveIcon = a.querySelector(".save-icon"); // Find the SVG inside 'a'
      console.log("SaveIcon :"+saveIcon)

      if (status === 200) {
        alert(body.message);

        // Toggle SVG icon based on response message
        if (body.message==="Post saved successfully.") {
          saveIcon.innerHTML = `
            <svg fill="currentColor" height="20" viewBox="0 0 20 20" width="20" 
                 xmlns="http://www.w3.org/2000/svg" class="save-icon"> 
              <path d="M4.114 20A1.117 1.117 0 0 1 3 18.884V2.628A1.629 1.629 0 0 1 
                       4.628 1h10.744A1.63 1.63 0 0 1 17 2.628v16.245a1.12 1.12 0 
                       0 1-1.718.946L10 16.479l-5.291 3.346a1.11 1.11 0 0 1-.595.175Z" />
            </svg>`;
        } else if (body.message==="Post unsaved successfully.") {
          saveIcon.innerHTML = `
            <svg fill="none" stroke="currentColor" stroke-width="1.5" height="20" 
                 viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg" 
                 class="save-icon"> 
              <path d="M4.114 20A1.117 1.117 0 0 1 3 18.884V2.628A1.629 1.629 0 0 1 
                       4.628 1h10.744A1.63 1.63 0 0 1 17 2.628v16.245a1.12 1.12 0 
                       0 1-1.718.946L10 16.479l-5.291 3.346a1.11 1.11 0 0 1-.595.175Z"/>
            </svg>`;
        }

      } else if (status === 401) {
        window.location.href = "/auth/login";
      } else {
        console.error('Unexpected error:', body);
        alert('An error occurred while saving the post.');
      }
    })
    .catch(error => console.error('Error:', error));
}
async function DeletePost(postId) { 
  // Get post element reference early
  const postElement = document.querySelector(`#post-options-${postId}`)?.closest('.post-card');
  const optionsMenu = document.getElementById(`post-options-${postId}`);

  try {
      // Hide options menu immediately
      if (optionsMenu) optionsMenu.style.display = "none";

      const response = await fetch(`/post/delete/${postId}`, {
          method: 'POST',
          headers: { 
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest' // Add this for server-side detection
          }
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error(data.message || 'Failed to delete post');
      }

      // Success handling
      if (postElement) {
          postElement.remove(); // Immediately remove post from DOM
      } else {
          window.location.reload(); // Fallback if element not found
      }

      // Optional: Show toast notification instead of alert
      showToastNotification(data.message || 'Post deleted successfully'); 

  } catch (error) {
      console.error('Delete post error:', error);
      
      // Show error with proper message
      showErrorNotification(error.message || 'Failed to delete post'); 

      // Restore options menu if deletion failed
      if (optionsMenu) optionsMenu.style.display = "block";
  }
}

async function ReportPost(postId){
   // Check if the user is logged in
   if (!isLoggedIn) {
    window.location.href = "/auth/login";
    return;
  }
  let a = document.getElementById(`post-options-${postId}`);
  a.style.display = "none";
  alert("Post Reported Successfully!")
}

//User Rank Badge
// Cache object to store user ranks temporarily
const userRankCache = {};


async function AddAuthorBadge(username, postId) {
  console.log("Trying to call rank");

  // Default badges with corresponding rank names
  const badges = {
      "Admin": { icon: "👑", name: "Admin" },
      "Moderator": { icon: "🛡️", name: "Moderator" },
      "Elite Member": { icon: "🌟", name: "Elite Member" },
      "Gold Member": { icon: "✨", name: "Gold Member" },
      "Fapper": { icon: "", name: "" } // No badge for Fapper
  };

  // Check if rank is cached
  if (userRankCache[username]) {
      let { icon, name } = userRankCache[username];
      document.getElementById(`badge-${postId}-${username}`).innerHTML = icon;
      document.getElementById(`tooltip-${postId}-${username}`).innerText = name;
  } else {
      try {
          // Fetch user rank
          const response = await fetch(`/user/rank?username=${encodeURIComponent(username)}`);
          const data = await response.json();
          const rankData = badges[data.rank] || { icon: "", name: "" };

          // Update UI
          document.getElementById(`badge-${postId}-${username}`).innerHTML = rankData.icon;
          document.getElementById(`tooltip-${postId}-${username}`).innerText = rankData.name;

          // Cache result
          userRankCache[username] = rankData;
      } catch (error) {
          console.error("Error fetching user rank:", error);
      }
  }
}

//Helper Logger
function showToastNotification(message) {
  // Implement a non-blocking notification system
  console.log('Success:', message);
}

function showErrorNotification(message) {
  // Implement error notification UI
  console.error('Error:', message);
  alert(message); // Fallback if you don't have a notification system
}




