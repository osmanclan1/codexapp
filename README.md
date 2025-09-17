# Student Schedule Studio

Student Schedule Studio turns messy syllabus calendars into a clean, visual planner. Paste your course schedule text and the app will detect dates, organise assignments and exams, show a weekly grid, and export everything as a calendar file you can import anywhere.

## ✨ Features

- **Smart parsing** – Detects month/day combinations and keywords (labs, exams, projects, readings) to categorise events automatically.
- **Visual dashboard** – Upcoming highlights, assignment lists, exam tracker, and live statistics.
- **Weekly layout** – Navigate through weeks to see each day at a glance, with inline time/type labels.
- **Reminders** – Opt-in browser notifications with configurable lead times. When notifications are not available, exported calendars include 1-day alarms.
- **Calendar export** – Download a `.ics` file for all events so you can import the schedule into Google Calendar, Outlook, or Apple Calendar.
- **Offline-friendly** – Everything is stored in your browser via localStorage. No accounts, no backend, free to host as a static site.

## 🚀 Getting started

```bash
npm install
npm run dev
```

Open the development server (default `http://localhost:5173`) and paste a schedule into the planner. When you are ready to share, run `npm run build` to produce a static bundle in `dist/`.

Helpful scripts:

- `npm run dev` – Start Vite in development mode.
- `npm run build` – Type-check and build the production bundle.
- `npm run lint` – Run ESLint across the project.

## 🧭 Usage tips

1. Paste the text calendar (table or outline) from your syllabus into the input.
2. Adjust the **Term year** if your semester crosses New Year.
3. Click **Build dashboard** to parse and organise the schedule.
4. Browse the dashboard cards, toggle reminders, and export to `.ics` when needed.
5. Use the Weekly layout navigator to jump through the semester.

A sample schedule is included to try the experience instantly.

## 🛠️ Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for the build tooling
- Browser Notifications API (optional) + ICS generation for calendar exports

Deploy the app to any static host (Netlify, Vercel, GitHub Pages, etc.) for free. Enjoy planning! 🎓
