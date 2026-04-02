# Snack Sync Rules

COPY_TO_SNACK.md debe reflejar exactamente:

estructura de estado
shape de context
nombres de funciones
props públicas
estructura de componentes
parsers
theme


# divergencia detectable si:

existe función en source no presente en Snack
existe función en Snack no presente en source
props distintas
reducers distintos
estado distinto


# estrategia

source primero
Snack después
misma lógica
sin simplificaciones