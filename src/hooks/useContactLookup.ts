import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { normalizePhone } from "../services/clientService";

export type ContactProfile = { name: string; email: string | null; birthday: string | null; addresses: { direccion: string; barrio?: string; referencia?: string; lastUsed?: string }[] };

export function useContactLookup(phone: string, onFound: (profile: ContactProfile) => void) {
  const [loading, setLoading] = useState(false);
  const callback = useRef(onFound);
  useEffect(() => { callback.current = onFound; }, [onFound]);
  useEffect(() => {
    const clean = normalizePhone(phone);
    if (!supabase || clean.length < 7 || clean.length > 15) {
      const idleTimer = window.setTimeout(() => setLoading(false), 0);
      return () => window.clearTimeout(idleTimer);
    }
    let active = true;
    const loadingTimer = window.setTimeout(() => setLoading(true), 0);
    const timer = window.setTimeout(() => {
      void supabase!.rpc("get_contact_by_phone", { p_phone: clean }).then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.[0]) callback.current(data[0] as ContactProfile);
        setLoading(false);
      });
    }, 450);
    return () => { active = false; window.clearTimeout(loadingTimer); window.clearTimeout(timer); };
  }, [phone]);
  return loading;
}
