import { useCallback, useEffect, useRef, useState } from "react";
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
  const initial = readLocalGrowthState();
  const [state, setState] = useState<LocalGrowthState>(initial);
  const stateRef = useRef(initial);

  const commit = useCallback((next: LocalGrowthState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const refresh = () => commit(readLocalGrowthState());
    window.addEventListener("storage", refresh);
    window.addEventListener("bible-friend:growth-local-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("bible-friend:growth-local-changed", refresh);
    };
  }, [commit]);

  const claim = useCallback((input: GrowthActivityInput) => {
    const outcome = claimLocalGrowthActivity(stateRef.current, input);
    commit(outcome.state);
    return outcome.result;
  }, [commit]);

  const upgrade = useCallback((equipmentId: EquipmentId) => {
    const outcome = upgradeLocalEquipment(stateRef.current, equipmentId);
    commit(outcome.state);
    return outcome;
  }, [commit]);

  const equip = useCallback((equipmentId: EquipmentId, equipped: boolean) => {
    const outcome = equipLocalEquipment(stateRef.current, equipmentId, equipped);
    commit(outcome.state);
    return outcome;
  }, [commit]);

  const verifyMemorization = useCallback((verseId: string, expected: string, spoken: string) => {
    const outcome = verifyLocalMemorization(stateRef.current, verseId, expected, spoken);
    commit(outcome.state);
    return outcome;
  }, [commit]);

  return { state, profile: state.profile, claim, upgrade, equip, verifyMemorization };
}
