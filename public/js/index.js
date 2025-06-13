

// REDIRECT TO PROFILE
function redirectToProfile(username) {
  document.getElementById('loading-overlay').style.display = 'flex';
  setTimeout(function() {
    window.location.href = `/user/profile/${username}`;
  }, 750);  // 100ms delay so the overlay appears
 
}

// INSTALL PROMPT HANDLING
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // Prevent the default mini-infobar
  deferredPrompt = e; // Save the event for later use
  const installButton = document.getElementById("install-button");
  if (installButton) {
    installButton.style.display = "flex"; // Show the install button
  }
});

function install() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the A2HS prompt.");
      } else {
        console.log("User dismissed the A2HS prompt.");
      }

      deferredPrompt = null;

      // Delay showing guest info by 10 seconds
      setTimeout(() => {
       // toggleGuestInfo(1);
      }, 10000); // 10,000 milliseconds = 10 seconds
    });
  }
}


// SERVICE WORKER REGISTRATION
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("Service Worker registered with scope:", registration.scope);
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  });
}

// NSFW MODAL HANDLING
document.addEventListener("DOMContentLoaded", () => {
  // const referrer = document.referrer;
  
  // // If there is a referrer, check if it's from the same site
  // if (referrer) {
  //   try {
  //     const referrerUrl = new URL(referrer);
  //     // Show modal only if the referrer hostname is different from the current hostname
  //     if (referrerUrl.hostname !== window.location.hostname) {
  //       showModal();
  //     }
  //   } catch (error) {
  //     // If parsing fails, fallback to showing the modal
  //     showModal();
  //   }
  // } else {
  //   // If there's no referrer (direct visit or privacy settings block it), show modal
  //   showModal();
  // }
  showModal()
});

function showModal() {
  const modal = document.getElementById("nsfwWarningModal");
  if (modal) {
    modal.style.display = "block";
  }
}

function closeModal() {
  const modal = document.getElementById("nsfwWarningModal");
  if (modal) {
    modal.style.display = "none";
  }
}


function toggleGuestInfo(value) {
  const box = document.getElementById("guestInfoBox");
  const divbox = document.getElementById("guestInfo");
  
  if (value === 1) {
    box.style.display = "block";
    box.style.height = "25vh";
    setTimeout(() => {
      box.style.height = "100vh";
    },1); 
  } else {
    box.style.display = "none";
  }
}

function startInteracting() {
  //alert("Let’s go! You’re ready to interact now.");
  toggleGuestInfo(0); // optional: hide after action
}


