# web-terminal shell integration. The server points ZDOTDIR here; each file
# sources the user's own counterpart (with ZDOTDIR set back to theirs while it
# runs) and the hooks are added at the end of .zshrc. See integration.zsh.
WT_INT_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="${WT_USER_ZDOTDIR:-$HOME}"
[[ -f "$ZDOTDIR/.zshenv" ]] && source "$ZDOTDIR/.zshenv"
WT_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$WT_INT_ZDOTDIR"
