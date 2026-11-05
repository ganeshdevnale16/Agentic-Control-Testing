export default function SpinnerIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="#86BC25"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
