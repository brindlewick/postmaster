# lint

Project custom lint rules live here, as TypeScript plugins against ESLint's rule API,
run through Oxlint.

The rules themselves are not this ticket's work: test placement is #158's, and the
functional style rules and the regex `u` flag rule are #171's. This directory holds
their place so the check pipeline and the formatter already cover it.
