import { useCallback, useEffect, useState } from "react";
import type { EquipmentId, GrowthActivityInput } from "@shared/growthDomain";
import {
  claimLocalGrowthActivity,
  equipLocalEquipment,
  readLocalGrowthState,
  upgradeLocalEquipment,
  verifyLocalMemorization,
  type LocalGrowthState,
} from "./localGrowthStore";

export function useLocalGrowth() {
  const [state, setState] = useState<LocalGrowthState>(() => readLocalGrowthState());

  useEffect(() => {
    const refresh = () => setState(readLocalGrowthState());
    window.addEventListener("storage", refresh);
    window.addEventListener("bible-friend:growth-local-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bible-friend:growth-local-changed", refresh);
    };
  }, []);

  const claim = useCallback((input: GrowthActivityInput) => {
    let outcome: ReturnType<typeof claimLocalGrowthActivity> | null = null;
    setState(current => {
      outcome = claimLocalGrowthActivity(current, input);
      return outcome.state;
    });
    if (!outcome) {
      outcome = claimLocalGrowthActivity(readLocalGrowthState(), input);
      setState(outcome.state);
    }
    return outcome.result;
  }, []);

  const upgrade = useCallback((equipmentId: EquipmentId) => {
    let outcome: ReturnType<typeof upgradeLocalEquipment> | null = null;
    setState(current => {
      outcome = upgradeLocalEquipment(current, equipmentId);
      return outcome.state;
    });
    return outcome;
  }, []);

  const equip = useCallback((equipmentId: EquipmentId, equipped: boolean) => {
    let outcome: ReturnType<typeof equipLocalEquipment> | null = null;
    setState(current => {
      outcome = equipLocalEquipment(current, equipmentId, equipped);
      return outcome.state;
    });
    return outcome;
  }, []);

  const verifyMemorization = useCallback((verseId: string, expected: string, spoken: string) => {
    let outcome: ReturnType<typeof verifyLocalMemorization> | null = null;
    setState(current => {
      outcome = verifyLocalMemorization(current, verseId, expected, spoken);
      return outcome.state;
    });
    if (!outcome) {
      outcome = verifyLocalMemorization(readLocalGrowthState(), verseId, expected, spoken);
      setState(outcome.state);
    }
    return outcome;
  }, []);

  return { state, profile: state.profile, claim, upgrade, equip, verifyMemorization };
}
