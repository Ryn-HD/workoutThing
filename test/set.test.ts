import { expect } from "chai";
import { Reps_isAmrap, Reps_isMaxEffortSet, Reps_setType } from "../src/models/set";
import { ISet } from "../src/types";

describe("set type compatibility", () => {
  it("reads old AMRAP sets through the canonical set type helper", () => {
    const set = { isAmrap: true } as ISet;

    expect(Reps_setType(set)).to.equal("amrap");
    expect(Reps_isAmrap(set)).to.equal(true);
    expect(Reps_isMaxEffortSet(set)).to.equal(true);
  });

  it("prefers setType over the legacy AMRAP bridge", () => {
    const set = { setType: "myoMini", isAmrap: true } as ISet;

    expect(Reps_setType(set)).to.equal("myoMini");
    expect(Reps_isAmrap(set)).to.equal(false);
    expect(Reps_isMaxEffortSet(set)).to.equal(false);
  });
});
