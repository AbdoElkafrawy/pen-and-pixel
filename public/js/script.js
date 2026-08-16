// =======================================================
//                    DARK MODE TOGGLE
// =======================================================

const themeToggleBtn = document.getElementById("theme-toggle");

function getSavedTheme() {
    return localStorage.getItem("theme") || "dark";
}

function applyTheme(theme) {
    if (theme === "dark") {
        document.body.classList.add("dark-theme");
        document.documentElement.classList.add("dark-theme");
        if (themeToggleBtn) themeToggleBtn.textContent = "☀️";
    } else {
        document.body.classList.remove("dark-theme");
        document.documentElement.classList.remove("dark-theme");
        if (themeToggleBtn) themeToggleBtn.textContent = "🌙";
    }
}

// Apply immediately on load
applyTheme(getSavedTheme());

if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
        const currentTheme = getSavedTheme();
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("theme", newTheme);
        applyTheme(newTheme);
    });
}


// =======================================================
//              CHARACTER COUNTERS (forms)
// =======================================================

const titleInput = document.getElementById("title");
const titleCounter = document.getElementById("title-counter");
const contentInput = document.getElementById("content");
const contentCounter = document.getElementById("content-counter");

function setupCounter(input, counter, maxLength, warningLimit, dangerLimit) {
    if (!input || !counter) return;

    function updateCounter() {
        const length = input.value.length;
        counter.textContent = `${length} / ${maxLength}`;
        counter.classList.remove("warning", "danger");
        if (length >= dangerLimit) {
            counter.classList.add("danger");
        } else if (length >= warningLimit) {
            counter.classList.add("warning");
        }
    }

    input.addEventListener("input", updateCounter);
    updateCounter();
}

setupCounter(titleInput, titleCounter, 100, 80, 95);
setupCounter(contentInput, contentCounter, 8000, 7000, 7800);


// =======================================================
//                    LIKE SYSTEM
// =======================================================

// localStorage is a key-value store built into every browser.
// It persists even after closing the tab.
// We use it to remember which posts this user has already liked.

function getLikedPosts() {
    return JSON.parse(localStorage.getItem("likedPosts") || "[]");
}

function toggleLikedPost(postId) {
    let liked = getLikedPosts();
    if (liked.includes(postId)) {
        // Remove from array if already liked
        liked = liked.filter(id => id !== postId);
    } else {
        // Add to array if not liked
        liked.push(postId);
    }
    localStorage.setItem("likedPosts", JSON.stringify(liked));
}

async function handleLike(e) {
    const btn = e.currentTarget;
    const postId = btn.dataset.postId;
    const isCurrentlyLiked = getLikedPosts().includes(postId);

    // Disable briefly while request is in flight
    btn.disabled = true;

    // Decide which action to take
    const endpoint = isCurrentlyLiked ? `/unlike/${postId}` : `/like/${postId}`;

    try {
        const response = await fetch(endpoint, { method: "POST" });

        if (response.ok) {
            const data = await response.json();

            // Update the number on the page
            btn.querySelector(".like-count").textContent = data.likes;

            // Toggle visual state and update localStorage
            if (isCurrentlyLiked) {
                btn.classList.remove("liked");
            } else {
                btn.classList.add("liked");
            }

            toggleLikedPost(postId);
        }

    } catch (error) {
        console.error("Like toggle error:", error);
    } finally {
        // Re-enable button so user can click again (to unlike or like)
        btn.disabled = false;
    }
}

function initLikeButtons() {
    const likedPosts = getLikedPosts();
    const likeButtons = document.querySelectorAll(".like-btn");

    likeButtons.forEach(btn => {
        const postId = btn.dataset.postId;

        // Mark as liked initially if stored in localStorage
        if (likedPosts.includes(postId)) {
            btn.classList.add("liked");
        }

        btn.addEventListener("click", handleLike);
    });
}

// Run when the page finishes loading
initLikeButtons();


// =======================================================
//         FORM DOUBLE-SUBMISSION PREVENTION
// =======================================================

function initFormProtection() {
    const forms = document.querySelectorAll("form");

    forms.forEach(form => {
        form.addEventListener("submit", function (e) {
            if (form.dataset.submitting === "true") {
                e.preventDefault();
                return false;
            }

            form.dataset.submitting = "true";

            const submitBtn = form.querySelector("button[type='submit'], input[type='submit']");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = "0.7";
                submitBtn.style.cursor = "not-allowed";

                const originalText = submitBtn.textContent || submitBtn.value;
                if (originalText.includes("Publish")) {
                    submitBtn.textContent = "⏳ Publishing...";
                } else if (originalText.includes("Save")) {
                    submitBtn.textContent = "⏳ Saving...";
                } else if (originalText.includes("Post")) {
                    submitBtn.textContent = "⏳ Posting...";
                } else if (originalText.includes("Delete")) {
                    submitBtn.textContent = "⏳ Deleting...";
                } else {
                    submitBtn.textContent = "⏳ Processing...";
                }
            }
        });
    });
}

initFormProtection();


// =======================================================
//            MOBILE HEADER & DRAWER NAVIGATION
// =======================================================

function initMobileHeader() {
    const menuToggleBtn = document.getElementById("mobile-menu-toggle");
    const menuCloseBtn = document.getElementById("mobile-menu-close");
    const backdrop = document.getElementById("mobile-menu-backdrop");
    const drawer = document.getElementById("mobile-nav-drawer");
    const searchToggleBtn = document.getElementById("mobile-search-toggle");
    const searchBar = document.getElementById("mobile-search-bar");

    function openDrawer() {
        if (drawer && backdrop) {
            drawer.classList.add("active");
            backdrop.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closeDrawer() {
        if (drawer && backdrop) {
            drawer.classList.remove("active");
            backdrop.classList.remove("active");
            document.body.style.overflow = "";
        }
    }

    if (menuToggleBtn) menuToggleBtn.addEventListener("click", openDrawer);
    if (menuCloseBtn) menuCloseBtn.addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);

    if (searchToggleBtn && searchBar) {
        searchToggleBtn.addEventListener("click", () => {
            searchBar.classList.toggle("active");
            const input = searchBar.querySelector("input");
            if (input && searchBar.classList.contains("active")) {
                input.focus();
            }
        });
    }

    // Categories Dropdown Sub-menu Accordion
    const catSubmenuToggle = document.getElementById("category-submenu-toggle");
    const catSubmenuList = document.getElementById("category-submenu-list");

    if (catSubmenuToggle && catSubmenuList) {
        catSubmenuToggle.addEventListener("click", () => {
            const isOpen = catSubmenuList.classList.toggle("active");
            catSubmenuToggle.classList.toggle("active");
            catSubmenuToggle.setAttribute("aria-expanded", isOpen);
        });
    }
}

initMobileHeader();


// =======================================================
//                NOTIFICATION BELL DROPDOWN
// =======================================================

function initNotifications() {
    const bellBtn = document.getElementById("notification-bell-btn");
    const menu = document.getElementById("notification-menu");
    const markReadBtn = document.getElementById("mark-notifications-read-btn");

    if (bellBtn && menu) {
        bellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            menu.classList.toggle("active");
        });

        document.addEventListener("click", (e) => {
            if (!menu.contains(e.target) && !bellBtn.contains(e.target)) {
                menu.classList.remove("active");
            }
        });
    }

    if (markReadBtn) {
        markReadBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            try {
                const res = await fetch("/notifications/mark-read", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    const badge = bellBtn ? bellBtn.querySelector(".notification-badge") : null;
                    if (badge) badge.remove();

                    const unreadItems = document.querySelectorAll(".notification-item.unread");
                    unreadItems.forEach(item => item.classList.remove("unread"));
                    markReadBtn.remove();
                }
            } catch (err) {
                console.error("Failed to mark notifications read:", err);
            }
        });
    }
}

initNotifications();

