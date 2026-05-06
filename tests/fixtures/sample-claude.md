# CLAUDE.md - Sample Test Fixture

This is a small fixture used by the parser test suite. It deliberately
contains a duplicated rule and a conflicting pair so the detection logic
can be asserted.

---

## KIM JESTEM

Sample identity block. NIGDY myślnika em (—) w komunikacji.
Mac: M1 Max. Apps Cloude folder na pulpicie. Bcrypt rounds 12 minimum.

---

## ZASADY PRACY

1. Bcrypt rounds 12 minimum dla wszystkich hasel.
2. Mollie nie Stripe dla NL projektow.
3. Apps Cloude folder na pulpicie obowiazkowy.
4. Nigdy nie pytaj o potwierdzenie, staly YES.

---

## MOJE PROJEKTY

### InvoiceFlow

InvoiceFlow MVP uzywa stripe €49 miesiecznie. To wyjatek od reguly Mollie.
Bcrypt rounds 12 minimum dla wszystkich hasel — same rule jak wyzej, ale
ten em-dash bedzie wykryty bo sekcja ma reglu zero em-dash.

### Octagon Sport

Octagon Sport NL klient. Shopify. Mollie nie Stripe (zgodne z regulami NL).

---

## RULE PRECEDENCE

This block resolves the contradiction above: InvoiceFlow keeps Stripe
for legacy reasons. New NL SaaS must use Mollie. The em-dash policy
applies to client deliverables, not internal docs like this one.
