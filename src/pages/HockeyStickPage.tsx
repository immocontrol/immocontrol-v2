import { useEffect } from "react";
import { HockeyStickSimulator } from "@/components/HockeyStickSimulator";

/**
 * Standalone page wrapper for the Hockey Stick Simulator.
 * Accessible via /hockey-stick route under Finanzen menu.
 */
const HockeyStickPage = () => {
  useEffect(() => {
    document.title = "Hockey Stick Simulator – ImmoControl";
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <HockeyStickSimulator embedded />
    </div>
  );
};

export default HockeyStickPage;
