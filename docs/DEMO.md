# Presenter walkthrough

All measurements and approvals in this application are synthetic demonstration material.

1. **Overview:** show 120 reusable records and the Welding scrap gap: Plant C 4.8% against Plant A 2.1%. Explain that these are fixed 30-day benchmark fixtures.
2. **Find reuse:** open Kaizen repository and search `welding fixture misalignment`. Welding improvements should lead the top 20 results. Explain the offline retrieval limitation rather than claiming sentence embeddings.
3. **Capture:** select Contributor 01. Create a new welding Kaizen with Plant A, baseline 4.8, Scrap Rate, root cause, countermeasure and an explicit synthetic evidence note. Save the draft. Search only covers approved knowledge; clear search and open the draft at the top of the repository. Drafts and pending decisions appear first.
4. **Review:** open the draft, Submit with a comment. Switch to Reviewer 02; open the submitted record and Review. Switch to Shop Head 03; Approve with a comment. Approval before review and Contributor approval are rejected by the API.
5. **Explain:** open Recommendations, choose the new approved Kaizen, inspect the six weighted factors. Plant C Welding should rank above unrelated shops. No recommendation applies a plant change automatically.
6. **Assign:** switch to Plant Coordinator 04 and assign Plant C / Welding, name the owner and choose a due date. Open Horizontal deployment, find the new assignment, and move through Review → Feasibility → Planned → Implemented with meaningful decision comments.
7. **Validate:** switch to Shop Head 03. Choose Validated. Enter baseline 4.8, post 2.1, unit `%`, window `30 days`, and synthetic observation evidence. The result is **56.25% improvement**, distinct from the **2.7 percentage-point** absolute reduction. A different unit or window is rejected.
8. **Close:** add lessons learned and close. Inspect the full timestamped history. The measured result may be negative; validation records an outcome and does not imply success.
9. **Audit:** switch to Auditor 06; open Audit trail and export JSON. Switch to Contributor 01 and show audit access denial.
10. **Recovery:** follow README backup commands. Start the restored database on a second port and verify that the new record and history remain.

Seeded records start at various lifecycle stages for convenient demonstrations. Their initial history contains a clearly labelled synthetic scenario event, not fabricated historical transitions. Newly created records accumulate actual application events.

## UAT record

Record presenter, reviewer, date, new Kaizen ID, HD ID, observed search rank, sign-off result, exported audit location and remaining issues. Human UAT and industrial acceptance have not been signed off by this project.
