// An explicit empty array means the author removed all sections.
export function introSections(project) {
  if (Array.isArray(project?.introSections)) return project.introSections
  return project?.description?.trim()
    ? [{ id: 'legacy-description', title: '项目介绍', body: project.description }]
    : []
}

export function coverAspect(project) {
  const { width, height } = coverDimensions(project)
  return `${width} / ${height}`
}

export function coverDimensions(project) {
  if (project?.coverWidth > 0 && project?.coverHeight > 0) return { width: project.coverWidth, height: project.coverHeight }
  const asset = project?.assets?.find((item) => item.src === project.cover || item.poster === project.cover) || (!project?.cover && project?.assets?.[0])
  return asset?.width > 0 && asset?.height > 0 ? { width: asset.width, height: asset.height } : { width: 1, height: 1 }
}
