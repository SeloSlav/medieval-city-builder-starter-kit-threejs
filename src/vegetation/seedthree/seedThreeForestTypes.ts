/** Runtime adapter so ForestManager never statically imports SeedThree (Node-safe). */
export type SeedThreeForestController = {
  hideTree(layoutIndex: number): void;
  showTree(layoutIndex: number): void;
  commit(): void;
  setShadows(enabled: boolean): void;
  dispose(): void;
};
