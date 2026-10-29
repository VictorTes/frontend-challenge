import { toast } from 'sonner'

/**
 * Editorial, support, activity, offers, downloads and social login are out of
 * the delivery scope. Their entry points stay visible (layout fidelity) but
 * say so explicitly instead of pretending to succeed.
 */
export function notAvailable(feature: string) {
  toast.message(`${feature} não está disponível nesta demonstração.`, { id: `oos-${feature}` })
}
