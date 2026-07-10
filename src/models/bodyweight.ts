import { IExerciseType, IPercentage, ISettings, IWeight } from "../types";
import { Equipment_getEquipmentIdForExerciseType, Equipment_getUnitOrDefaultForExerciseType } from "./equipment";
import { Weight_build } from "./weight";

export function Bodyweight_isExercise(settings: ISettings, exerciseType?: IExerciseType): boolean {
  return Equipment_getEquipmentIdForExerciseType(settings, exerciseType) === "bodyweight";
}

export function Bodyweight_zeroAddedLoad(settings: ISettings, exerciseType?: IExerciseType): IWeight {
  return Weight_build(0, Equipment_getUnitOrDefaultForExerciseType(settings, exerciseType));
}

export function Bodyweight_displayWeight<T extends IWeight | IPercentage>(
  weight: T | undefined,
  isBodyweight: boolean
): T | undefined {
  return isBodyweight && weight?.unit !== "%" && weight?.value === 0 ? undefined : weight;
}
