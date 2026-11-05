// Fixed context for the control under test. Shown in the welcome message and
// carried into the report header / Excel summary.
export const CONTROL = {
  id: "ITGC-AC-02",
  name: "SAP password configuration",
  domain: "Logical access – Authentication",
  objective:
    "System-enforced password settings on in-scope SAP systems comply with the approved password policy, so that only authorised users can authenticate to financially significant applications.",
  risk:
    "Weak or non-compliant password settings allow unauthorised access to SAP, resulting in inappropriate changes to financial data or configuration (ICFR relevant).",
  description:
    "Password rules are enforced automatically by SAP through profile parameters (login/* and rdisp/*). SAP Basis maintains the parameters in the system profiles in line with the approved IT security password policy.",
  type: "Automated – application configuration",
  nature: "Preventive",
  frequency: "Continuous (system-enforced)",
  approach:
    "Test of one for an automated control: inspect the active profile parameter values on every application server instance and compare them to each measurable policy requirement. Population completeness and accuracy (IPE) is validated before testing.",
  owner: "SAP Basis / IT Security",
};

export const DEMO_POLICY_NAME = "Demo – SAP Password Policy v2.1";

export const DEMO_POLICY = `Password Configuration Policy – SAP Systems (v2.1, approved by CISO)
1. Minimum password length must be at least 10 characters.
2. Passwords must contain at least 1 digit.
3. Passwords must contain at least 1 special character.
4. Passwords must contain at least 1 uppercase letter and 1 lowercase letter.
5. The system must remember the last 5 passwords (password history).
6. User accounts must be locked after at most 5 failed login attempts.
7. Passwords must expire within 90 days.
8. A new password must differ from the previous one by at least 3 characters.
9. Idle sessions must be logged out automatically after at most 15 minutes of inactivity.
10. Initial passwords not used within 14 days must expire.
11. Users must not share their passwords with anyone, including IT staff.
12. Privileged account passwords must be stored in the approved password vault.`;
