# Independent plan guidance

- Each `<plan-id>` directory is an overlay for one customer plan.
- Keep base application code in this repository; plans contain configuration, content, branding, and approved extensions only.
- A plan must declare `client_id`, `agent_path`, `base_client_version`, and `template_version` in `plan.yaml`.
- Never place credentials, database dumps, or production downloads in a plan directory.
