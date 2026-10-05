# UI/UX & Product Design Decisions — Project Sahayog (Seva Setu)

This document compiles the design system, user flows, and product decisions implemented throughout the **Sahayog** platform. It is structured to serve as professional documentation for project reports and UI/UX portfolios.

---

## 1. Visual Identity & Design System

### A. Theme & Core Concept
*   **Concept**: *Calm, Community-Focused, Human-Centered NGO*.
*   **Design Values**: Organic, clean, high-legibility, modern typography, and non-dramatic soft surfaces.
*   **Fonts**: 
    *   **Primary Font**: `Outfit` (sans-serif) — used for all main UI components, buttons, inputs, and details to give a humanist, approachable vibe.
    *   **Header Logo**: `Merriweather` (serif) — used exclusively for the brand title ("Sahayog") to project authority, trust, and institutional credibility.

### B. Color Tokens (`design-tokens.css`)
We avoided generic high-contrast colors, opting for a curated organic palette:
*   **Primary Green (`#246427`)**: Signifies growth, ecology, and community coordination. Used for main action buttons, active sidebar links, and success states.
*   **Light Green (`#E8F5E9` / `#F1F8E9`)**: Used as background fills for active links, buttons, and success cards.
*   **Accent Gold (`#F8AC3B` / `#FFF8E1`)**: Warm orange-gold tones used for warnings and items requiring review, drawing attention without causing anxiety.
*   **Soft Surface Background**: Gradient transition from pale olive-gray to clean cream (`linear-gradient(to bottom, #DCE9D5 0%, #F9FDF7 20%, #F9FDF7 100%)`) for dashboard views. This replaces harsh white screens to minimize eye strain during long usage.
*   **Borders & Grays**: Warm light borders (`#E0E7DC`) and charcoal text (`#212121`) instead of pure black (`#000000`) for softer contrast.
*   **Soft Green Shadows (`--shadow-card`)**: Instead of harsh neutral dark shadows, cards utilize a soft, low-opacity green shadow: `0 2px 12px rgba(36,100,39,0.07)`, making the panels feel organically integrated.

---

## 2. Dynamic Portals & Navigation Layout

The application organizes operations across three user roles: **Field Worker**, **Team Lead**, and **Admin**.

*   **Responsive Sidebars**: Clean sidebars for desktops (`md:flex`) and slide-out hamburger navigation drawers for mobile screens (`md:hidden`) using `Framer Motion` animations.
*   **Responsive Header Breadcrumbs**: When navigating deep into sub-pages (e.g. submitting a report, marking attendance), a back arrow (`ArrowLeft`) automatically renders in the header, keeping the interface uncluttered and preventing mobile workers from getting lost.
*   **Role-Specific Action Prompts**: Navigational layouts adapt dynamically. For example, Team Leads get immediate access to "Create Task" shortcuts directly from the header on pages where task scheduling is relevant.

---

## 3. Field Worker Module — Product & UX Decisions

### A. Guided Multi-Step Check-In/Check-Out
*   **UX Pattern**: Form splits into a wizard step-by-step modal: `['GPS Location', 'Face Capture', 'Before/After Photo', 'Confirm']`.
*   **Rationale**: Simplifies complex data capture (biometrics, site photos, location tracking) into distinct, single-focus screens, preventing errors and reducing cognitive load on mobile devices under bright sunlight.

### B. Proximity-Based Geo-Fencing (Haversine Verification)
*   **Feature**: Real-time GPS location compared with task coordinates.
*   **UX Indicators**: High-contrast, clean badges indicate location range status:
    *   `✓ Within range (45m)` (Green)
    *   `⚠ 340m from site (limit: 100m) — will be flagged` (Gold)
*   **Operational Resilience**: If a worker is out of range, the system **does not block work**. Instead, it lets them check in but flags the record for Team Lead review. This ensures work isn't halted due to temporary GPS drift or device accuracy issues.

### C. Proxy-Attendance & Visual Auditing (Biometric Face Recognition)
*   **Identity Match**: Uses real-time webcam captures matching facial contours against a registered profile via a Python-based Flask microservice API (`face_recognition` Euclidean distance calculation).
*   **Mock Fallback**: Automatically falls back to a mock mode when face-recognition dependencies are missing, allowing easy developer testing across varying OS setups.
*   **Proof of Work**: Integrates native mobile device camera triggers (`capture="environment"`) prompting workers to capture field photos *before* and *after* shift completion.

### D. Early Checkout Protection
*   **Check-Out Interceptor**: If checkout is initiated before the task's scheduled end time (minus buffer minutes configured by the lead), the UI forces an early checkout warning.
*   **UX Flow**: Disables submission until the worker enters an official reason of early departure in a text area, ensuring full accountability.

### E. Dynamic Activity Reports
*   **Feature**: Submission form dynamically maps and renders the custom fields configured by the lead for that specific task (e.g. Number inputs for weights, dropdowns for Yes/No, textareas for remarks).
*   **Visual Evidence**: Workers can upload up to 5 field photos, rendering instant thumbnail previews with quick-delete overlay buttons.

---

## 4. Team Lead Module — Product & UX Decisions

### A. Action-Focused Dashboards
*   **Design Decision**: Avoided passive stat summaries. Metrics focus on daily operations that need attention: `Active Tasks`, `Workers Present (ratio)`, `Flagged Today (needs review)`, and `Pending Leaves (awaiting action)`.

### B. Dashboard Resolution Modals
*   **UX Flow**: Leads can review flagged attendance alerts or leave requests immediately in responsive overlay drawers directly on the dashboard.
*   **Audit Compliance**: Form validation requires Team Leads to type a minimum 10-character "Action Remark" before resolving flags, ensuring a clear compliance history.

### C. Smart Task Configuration & Conflict Avoidance
*   **Auto-Location Lookup**: Incorporates debounced search input querying coordinates automatically to prevent copy-paste errors.
*   **Conflict-Aware Assignment**: The worker selection step queries the database for worker schedules during that specific time frame, highlighting only available workers and blocking double-bookings.
*   **Fatigue Warning**: Displays warning alerts next to workers whose weekly scheduled hours exceed 35 hours (`⚠ 38h/wk`), assisting leads in fair labor distribution.

---

## 5. Administrator Module — Product & UX Decisions

### A. Active Operations & Nudge System
*   **UX Pattern**: Segregates reports from team leads by `All`, `Unread`, and `Pending Submission`.
*   **Lead Nudges**: System lists team leads who haven't submitted weekly summaries and lets admins send a "Request Report" nudge alert with a single click.

### B. Rich Analytical Insights
*   **Data Visualization**: Integrated Chart.js to map organizational operations:
    *   **NGO Attendance Trend (Line Chart)**: Represents the rolling attendance rate over 30 days.
    *   **Verification Status (Doughnut Chart)**: Shows proportions of Verified, Pending, Flagged, and Rejected attendances.
    *   **Team Performance Comparison (Horizontal Bar Chart)**: Ranks teams by compliance rate.
    *   **Task Type Analysis (Grouped Bar Chart)**: Present vs. absent ratios grouped by category.
*   **Delta Progress Tracking**: Shows month-over-month variances (e.g., `↑ 5.2%` or `↓ 2%`) to easily assess efficiency.
*   **Report Generation**: Includes one-click structured table paging and quick CSV exports.

---

## 6. Technical Architecture UX Choices

*   **Cloud-Based Storage Migration**: Replaced local file storage with Cloudinary buckets (`sevasetu/faces`, `sevasetu/attendance`, `sevasetu/reports`) integrated via Multer, providing optimal file uploads and rendering optimizations without bloating the Node database.
*   **Asynchronous Processing**: Python Flask face recognition is hosted on a separate port (`5001`), separating computational biometrics from standard routing workloads and keeping response times low on the client side.
