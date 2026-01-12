import { useEffect, useState } from "react";
import { userApi } from "../services/api";

export const useUserName = (phone?: string) => {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!phone) return;
      try {
        const res = await userApi.getByPhone(phone);
        if (res?.user?.name) setName(res.user.name);
      } catch {
        setName(null);
      }
    };
    run();
  }, [phone]);

  return name;
};
