# Phoenix Course Seed Data

`phoenix-course-seed.csv` tracks the Phoenix-area course data we want to preload.

The current target is one men's Blue/White-equivalent tee per course:

- `course_rating` and `slope_rating` should come from the USGA Course Rating Database or an official/current scorecard.
- `hole_*_par` and `hole_*_hcp` should come from an official scorecard, PDF, or verified OpenStreetMap course-hole data.
- `pcc_default` should stay `0`. PCC is a daily playing-conditions adjustment, not a fixed course value.
- `verification_status` should be `pending`, `partial`, or `verified`.
- `source_url` should point to the page/PDF used for verification.
- `verified_date` should use `YYYY-MM-DD`.

Supabase storage:

- Course identity and holes go into `saved_courses` and `saved_course_holes`.
- Tee rating/slope rows go into `saved_course_tees`.

The migration in `supabase-multi-foursome.sql` creates those tables and policies.
