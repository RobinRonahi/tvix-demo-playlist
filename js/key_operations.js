/* ==== key_operations.js – Clean & Extendable ==== */
"use strict";

/**
 * Confirm parental control password depending on current route
 */
function confirmParentPassword() {
  switch (current_route) {
    case "home-page":
      if (home_page && typeof home_page.confirmParentPassword === "function") {
        home_page.confirmParentPassword();
      }
      break;

    // Future routes can be added here:
    // case "settings-page":
    //   settings_page.confirmParentPassword();
    //   break;

    default:
      console.warn("[confirmParentPassword] No handler for route:", current_route);
      break;
  }
}

/**
 * Cancel parental control password depending on current route
 */
function cancelParentPassword() {
  switch (current_route) {
    case "home-page":
      if (home_page && typeof home_page.cancelParentPassword === "function") {
        home_page.cancelParentPassword();
      }
      break;

    // Future routes can be added here:
    // case "settings-page":
    //   settings_page.cancelParentPassword();
    //   break;

    default:
      console.warn("[cancelParentPassword] No handler for route:", current_route);
      break;
  }
}