/**
 * UX-15: Success Animations after save
 * Short checkmark animation overlay after successful operations.
 */
import { useState, useEffect, useCallback } from "react";
import { Check } from "lucide-react";

export function useSuccessAnimation() {
  const [visible, setVisible] = useState(false);

  const trigger = useCallback(() => {
    setVisible(true);
    setTimeout(() => setVisible(false), 1200);
  }, []);

  return { visible, trigger };
}

interface SuccessAnimationProps {
  visible: boolean;
}

export function SuccessAnimation({ visible }: SuccessAnimationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none">
      <div className="w-16 h-16 rounded-full bg-profit/20 flex items-center justify-center animate-success-pop">
        <div className="w-10 h-10 rounded-full bg-profit flex items-center justify-center">
          <Check className="h-6 w-6 text-white animate-success-check" />
        </div>
      </div>
    </div>
  );
}
