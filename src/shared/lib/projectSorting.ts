export const compareProjectNames = (left: { name: string }, right: { name: string }) => (
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
);

export const sortProjectsByTracking = <T extends { id: string; name: string }>(
  projects: T[],
  trackedProjectIds: string[],
) => {
  const trackedSet = new Set(trackedProjectIds);
  return [...projects].sort((left, right) => {
    const leftTracked = trackedSet.has(left.id);
    const rightTracked = trackedSet.has(right.id);
    if (leftTracked !== rightTracked) return leftTracked ? -1 : 1;
    return compareProjectNames(left, right);
  });
};
