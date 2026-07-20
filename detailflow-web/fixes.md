
We need to implement the following improvements while keeping the design system, UX, and code quality consistent across the application. Follow the existing architecture and reuse shared components whenever possible.

### Objectives

1. **Redesign the Register & Login Pages**

   * Redesign both pages to match the new landing page theme and branding.
   * Maintain a modern, premium, and minimal aesthetic.
   * Ensure excellent mobile responsiveness.
   * Improve spacing, typography, visual hierarchy, and accessibility.
   * Keep authentication flows unchanged unless improvements are necessary.
   changes based on the landing page theme 


2. **Analytics Page Improvements**

   * Add filtering options that allow users to view historical/older analytics data.
   * Improve the chart layout to make the dashboard cleaner and easier to read.
   * Optimize spacing, alignment, responsiveness, and overall visual presentation.
   * Preserve existing functionality while improving usability.

3. **Landing Page Showcase Improvements**

   * Replace placeholder/mockup content with actual application screenshots.
   * **Tracking tab:** display the real Tracking screen.
   * **Analytics tab:** display the real Analytics screen.
   * Ensure screenshots are high quality, responsive, and consistent with the landing page design.


5. **Dashboard Light Theme**

   * Add full Light Theme support for the dashboard.
   * Ensure every component works correctly in both Light and Dark themes.
   * Maintain consistent colors, contrast, typography, and accessibility.
   * Avoid duplicated styling where possible by extending the existing theming system.

6. **Tenant-Based Language Configuration**

   * Move language configuration to the administration settings.
   * Allow **Tenant Admins** and **Super Admins** to configure the default application language for each tenant.
   * Ensure the selected language is automatically applied throughout the application for users within that tenant.
   * Follow the existing localization architecture and make the solution scalable for additional languages.

### General Requirements

* Maintain consistency with the new landing page design language.
* Use existing shared UI components whenever possible.
* Ensure all pages are fully responsive and mobile-first.
* Preserve existing functionality unless improvements are explicitly required.
* Follow clean architecture, best practices, and the project's coding standards.
* Minimize technical debt and avoid unnecessary complexity.
* Ensure accessibility, performance, and maintainability are considered throughout the implementation.


2. **Redesign the Book a Demo Page**

   * Redesign the page to match the landing page style.
   * Convert it into a modern multi-step form (wizard) if it improves the user experience.
   * Prioritize simplicity, clarity, and mobile-first usability.
   * Include smooth transitions, progress indicators, and proper validation.
   * Make the experience feel polished and frictionless.