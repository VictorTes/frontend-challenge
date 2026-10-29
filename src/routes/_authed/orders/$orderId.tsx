import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/orders/components/order-page'

export const Route = createFileRoute('/_authed/orders/$orderId')({
  component: OrderRoute,
})

function OrderRoute() {
  const { orderId } = Route.useParams()
  return <OrderPage key={orderId} orderId={orderId} />
}
