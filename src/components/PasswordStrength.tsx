import { useMemo } from "react";

interface PasswordStrengthProps {
  password: string;
}

export const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score: 1, label: "Schwach", color: "bg-loss" };
    if (score <= 2) return { score: 2, label: "Mäßig", color: "bg-gold" };
    if (score <= 3) return { score: 3, label: "Gut", color: "bg-primary" };
    return { score: 4, label: "Stark", color: "bg-profit" };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i <= strength.score ? strength.color : "bg-secondary"
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] ${
        strength.score <= 1 ? "text-loss" : strength.score <= 2 ? "text-gold" : "text-profit"
      }`}>
        {strength.label}
      </p>
    </div>
  );
};
