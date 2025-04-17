document.addEventListener("DOMContentLoaded", function () {
  // Check if user is logged in
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  if (!token || !user.username) {
    // Redirect to login if not authenticated
    window.location.href = "auth/login.html";
    return;
  }

  // API URL
  const API_URL = "http://localhost:8000/api";

  // Variables
  const welcomeContainer = document.getElementById("welcomeContainer");
  const chatContent = document.getElementById("chatContent");
  const contactsList = document.getElementById("contactsList");

  let currentContact = null;

  // Function to set active contact and show chat
  function setActiveContact(contactName) {
    // Hide welcome container and show chat content
    welcomeContainer.style.display = "none";
    chatContent.style.display = "flex";

    // Update chat header with contact info
    updateChatHeader(contactName);

    // Set current contact for sending messages
    currentContact = contactName;

    // Also update the messagesManager's current contact
    if (window.messagesManager) {
      window.messagesManager.setCurrentContact(contactName);

      // Fetch messages for this contact
      window.messagesManager.fetchMessages(contactName);
    }
  }

  // Update chat header with contact info
  function updateChatHeader(contactName) {
    document.querySelector(".chat-header .contact-name").textContent =
      contactName;

    // Find contact in contacts list to get their status and avatar
    const contactElement = document.querySelector(`.contact[data-username="${contactName}"]`);
    if (contactElement) {
      const statusEl = contactElement.querySelector(".status");
      const avatarImg = contactElement.querySelector(".contact-avatar img");

      if (avatarImg) {
        document.querySelector(".chat-header .contact-avatar img").src = avatarImg.src;
      }

      if (statusEl) {
        const isOnline = statusEl.classList.contains("online");
        document.querySelector(".chat-header .status").className = `status ${isOnline ? "online" : "offline"}`;
        document.querySelector(".chat-header .contact-status").textContent = isOnline ? "Online" : "Offline";
      }
    }
  }

  // Fetch contacts from the server
  async function fetchContacts() {
    try {
      const response = await fetch(`${API_URL}/contacts/contacts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }

      const data = await response.json();
      const noContactsMessage = document.getElementById("noContactsMessage");

      // Clear any existing contacts
      contactsList.innerHTML = "";

      if (data.contacts && data.contacts.length > 0) {
        // Hide the no contacts message
        if (noContactsMessage) {
          noContactsMessage.style.display = "none";
        }

        // Create HTML for each contact
        data.contacts.forEach((contact) => {
          const contactHTML = `
                        <div class="contact" data-username="${
                          contact.username
                        }">
                            <div class="contact-avatar">
                                <img src="${
                                  contact.profilePicture ||
                                  "images/shrek-logo.jpg"
                                }" alt="${contact.username}">
                                <span class="status ${
                                  contact.status?.toLowerCase() === "online"
                                    ? "online"
                                    : "offline"
                                }"></span>
                            </div>
                            <div class="contact-info">
                                <div class="contact-name">${
                                  contact.username
                                }</div>
                                <div class="contact-last-message">No messages yet</div>
                            </div>
                            <div class="contact-meta">
                                <div class="contact-time"></div>
                            </div>
                        </div>
                    `;
          contactsList.insertAdjacentHTML("beforeend", contactHTML);
        });

        // Re-attach event listeners to the new contacts
        attachContactEventListeners();

        // By default, show welcome message (don't auto-select first contact)
        welcomeContainer.style.display = "flex";
        chatContent.style.display = "none";
      } else {
        // Show no contacts message
        if (noContactsMessage) {
          noContactsMessage.style.display = "flex";
        }

        // Show welcome message when no contacts
        welcomeContainer.style.display = "flex";
        chatContent.style.display = "none";
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  }

  // Function to attach event listeners to contacts
  function attachContactEventListeners() {
    const contacts = document.querySelectorAll(".contact");

    contacts.forEach((contact) => {
      contact.addEventListener("click", function () {
        // Remove active class from all contacts
        contacts.forEach((c) => c.classList.remove("active"));

        // Add active class to clicked contact
        this.classList.add("active");

        // Get the contact name
        const contactName = this.dataset.username;

        // Set active contact and display chat
        setActiveContact(contactName);

        // Remove unread count badge if exists
        const unreadBadge = this.querySelector(".unread-count");
        if (unreadBadge) {
          unreadBadge.remove();
        }

        // For mobile: close sidebar when contact is selected
        if (window.innerWidth <= 768) {
          const sidebar = document.querySelector(".sidebar");
          sidebar.classList.remove("open");
        }
      });

      // Context menu for viewing profile
      contact.addEventListener("contextmenu", function (e) {
        e.preventDefault();

        // Update the view profile popup with contact info
        const contactName = this.querySelector(".contact-name").textContent;

        document.querySelector(
          "#viewProfilePopup .profile-view-avatar img"
        ).src = "images/shrek-logo.jpg";
        document.querySelector("#viewProfilePopup h3").textContent =
          contactName;

        // Open the view profile popup
        openPopup("viewProfile");
      });
    });
  }

  // Load user profile data
  async function loadUserProfile() {
    try {
      const response = await fetch(`${API_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const data = await response.json();

      // Update profile sidebar with user data
      document.getElementById("profileName").textContent =
        data.username || user.username;
      document.getElementById("profileStatus").textContent =
        data.status || "Online";

      // Set profile pictures
      const profilePicture = data.profilePicture || "images/shrek-logo.jpg";
      document.getElementById("profilePicture").src = profilePicture;
      document.getElementById("profileEditAvatar").src = profilePicture;

      // Update profile in edit profile popup
      document.getElementById("profileEditName").value =
        data.username || user.username;
      document.getElementById("profileEditEmail").value = data.email || "";

      // Parse phone number to separate country code and number if exists
      if (data.phone) {
        const phoneMatch = data.phone.match(/^(\+\d+)\s*(.*)$/);
        if (phoneMatch) {
          const countryCodeSelect = document.getElementById("countryCode");
          const phoneInput = document.getElementById("profileEditPhone");

          // Set the country code if it matches one of our options
          const countryCode = phoneMatch[1];
          for (let i = 0; i < countryCodeSelect.options.length; i++) {
            if (countryCodeSelect.options[i].value === countryCode) {
              countryCodeSelect.selectedIndex = i;
              break;
            }
          }

          // Set the phone number
          phoneInput.value = phoneMatch[2];
        } else {
          document.getElementById("profileEditPhone").value = data.phone;
        }
      }

      // Set country if exists
      if (data.country) {
        const countrySelect = document.getElementById("profileEditCountry");
        for (let i = 0; i < countrySelect.options.length; i++) {
          if (countrySelect.options[i].value === data.country) {
            countrySelect.selectedIndex = i;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  // Save profile changes
  const saveProfileButton = document.getElementById("saveProfileButton");
  if (saveProfileButton) {
    saveProfileButton.addEventListener("click", async function () {
      const username = document.getElementById("profileEditName").value;
      const email = document.getElementById("profileEditEmail").value;
      const countryCode = document.getElementById("countryCode").value;
      const phoneNumber = document.getElementById("profileEditPhone").value;
      const country = document.getElementById("profileEditCountry").value;

      // Format the phone number with country code
      const phone = phoneNumber ? `${countryCode} ${phoneNumber}` : "";

      try {
        const response = await fetch(`${API_URL}/users/update-profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            username,
            email,
            phone,
            country,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update profile");
        }

        // Reload profile data
        loadUserProfile();

        // Close popup
        closeAllPopups();

        // Show success message
        alert("Профиль успешно обновлен");
      } catch (error) {
        console.error("Error updating profile:", error);
        alert("Не удалось обновить профиль");
      }
    });
  }

  // Profile sidebar toggle
  const profileButton = document.getElementById("profileButton");
  const profileSidebar = document.getElementById("profileSidebar");
  const overlay = document.getElementById("overlay");

  profileButton.addEventListener("click", function () {
    profileSidebar.classList.add("open");
    overlay.classList.add("active");
  });

  // Close profile sidebar when clicking on close button or overlay
  document
    .querySelector(".close-profile")
    .addEventListener("click", function () {
      profileSidebar.classList.remove("open");
      overlay.classList.remove("active");
      closeAllPopups();
    });

  overlay.addEventListener("click", function () {
    profileSidebar.classList.remove("open");
    overlay.classList.remove("active");
    closeAllPopups();
  });

  // Profile menu items event listeners
  const menuItems = document.querySelectorAll(".profile-menu .menu-item");

  menuItems.forEach((item) => {
    item.addEventListener("click", function () {
      const menuText = this.querySelector("span").textContent;

      switch (menuText) {
        case "Мой профиль":
          openPopup("editProfilePopup");
          break;
        case "Новая группа":
          openPopup("createGroupMembersPopup");
          break;
        case "Добавить друга":
          openPopup("addFriendsPopup");
          break;
        case "Выйти":
          // Handle logout
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "auth/login.html";
          break;
        // Other menu items can be handled here
      }
    });
  });

  // Theme toggle functionality
  const themeToggle = document.getElementById("themeToggle");

  // Apply saved theme on page load
  if (localStorage.getItem("darkTheme") === "true") {
    document.body.classList.add("dark-theme");
    themeToggle.checked = true;
  }

  // Add event listener to theme toggle
  themeToggle.addEventListener("change", function () {
    if (this.checked) {
      document.body.classList.add("dark-theme");
      localStorage.setItem("darkTheme", "true");
    } else {
      document.body.classList.remove("dark-theme");
      localStorage.setItem("darkTheme", "false");
    }
  });

  // Popup management functions
  function openPopup(popupId) {
    // Hide all popups first
    const popups = document.querySelectorAll(".popup");
    popups.forEach((popup) => popup.classList.remove("open"));

    // Show the requested popup
    const popup = document.getElementById(popupId);
    if (popup) {
      popup.classList.add("open");
    }
  }

  function closeAllPopups() {
    const popups = document.querySelectorAll(".popup");
    popups.forEach((popup) => popup.classList.remove("open"));
  }

  // Add event listeners to close buttons in popups
  const closeButtons = document.querySelectorAll(".close-popup");
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeAllPopups);
  });

  // Set up delete all messages functionality
  document
    .getElementById("deleteAllMessages")
    .addEventListener("click", function () {
      if (
        currentContact &&
        confirm(
          `Are you sure you want to delete all messages with ${currentContact}?`
        )
      ) {
        // Use the messagesManager to delete messages
        if (window.messagesManager) {
          window.messagesManager.deleteAllMessages(currentContact);
        }
      }
    });

  // Make fetchContacts globally available
  window.fetchContacts = fetchContacts;

  // Initialize
  loadUserProfile();
  fetchContacts();
});
