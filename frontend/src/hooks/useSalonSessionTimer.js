import { useState, useEffect } from "react";

export default function useSalonSessionTimer(openDate, openTime) {
  const [duration, setDuration] = useState({
    hours: 0,
    minutes: 0,
  });

  useEffect(() => {
    if (!openDate || !openTime) {
      setDuration({ hours: 0, minutes: 0 });
      return;
    }

    const calculateDuration = () => {
      // Create a Date from your stored date and time
      const openedAt = new Date(`${openDate}T${openTime}`);

      const now = new Date();

      const diffMilliseconds = now - openedAt;

      const totalMinutes = Math.floor(diffMilliseconds / (1000 * 60));

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      setDuration({
        hours,
        minutes,
      });
    };

    calculateDuration();

    const interval = setInterval(calculateDuration, 60000);

    return () => clearInterval(interval);
  }, [openDate, openTime]);

  return duration;
}
