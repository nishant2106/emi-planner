# EMI Planner

A fast, dependency-free loan planner. Enter a loan amount, interest rate and tenure to see:

- **Monthly EMI**, total interest and total amount paid
- A **principal vs interest** breakdown
- An **outstanding balance chart** over the life of the loan
- A **yearly or monthly amortization schedule**, downloadable as CSV
- **Prepayment savings**: add an extra monthly payment and see how much interest it saves and how many months sooner the loan closes

Inputs are kept in the URL, so any scenario can be shared with a link. Supports INR, USD, EUR and GBP, and follows the system light/dark theme.

## How it works

EMI uses the standard reducing-balance formula:

```
EMI = P · r · (1 + r)^n / ((1 + r)^n − 1)
```

where `P` is the principal, `r` the monthly interest rate and `n` the number of months. The schedule is computed month by month: each EMI pays that month's interest first, the rest reduces the principal, and any extra payment goes straight to principal.

## Tech

Plain HTML, CSS and JavaScript with Canvas charts. No build step, no frameworks, no tracking. Your numbers never leave the browser.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
