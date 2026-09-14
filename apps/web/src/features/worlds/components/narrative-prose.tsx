const handlePattern = /((?<![A-Za-z0-9_])@[A-Za-z0-9_]+)/g;

export function NarrativeProse({ text }: { text: string }) {
  return text.split(handlePattern).map((part, index) =>
    /^@[A-Za-z0-9_]+$/.test(part) ? (
      <span key={index} className="font-semibold text-brand-sentinel">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
