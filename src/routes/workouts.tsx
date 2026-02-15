import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/workouts')({
  component: WorkoutsLayout,
})

function WorkoutsLayout() {
  return <Outlet />
}
