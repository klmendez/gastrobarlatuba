// La carta de La Tuba no utiliza los toppings del catálogo anterior.
export const ToppingAvailabilityService = {
  async getDisabledToppingIds(): Promise<string[]> { return []; },
  subscribe(callback: (disabledIds: string[]) => void): () => void { callback([]); return () => {}; },
  async setToppingAvailability(toppingId: string, disabled: boolean): Promise<void> { void toppingId; void disabled; },
};
