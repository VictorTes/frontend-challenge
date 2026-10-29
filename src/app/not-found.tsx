import { Link } from '@tanstack/react-router'

export function NotFoundPage({
  title = 'Página não encontrada',
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <section className="container-page flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-6xl font-bold text-highlight">404</p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">
        {description ?? 'O endereço acessado não existe ou foi removido.'}
      </p>
      <Link
        to="/"
        className="rounded-[4px] bg-primary px-6 py-2.5 font-bold text-primary-foreground hover:bg-highlight"
      >
        Voltar ao início
      </Link>
    </section>
  )
}
