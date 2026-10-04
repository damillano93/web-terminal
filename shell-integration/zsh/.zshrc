ZDOTDIR="$WT_USER_ZDOTDIR"
[[ -f "$ZDOTDIR/.zshrc" ]] && source "$ZDOTDIR/.zshrc"
ZDOTDIR="$WT_INT_ZDOTDIR"
source "$WT_INT_ZDOTDIR/integration.zsh"
# A non-login shell reads no .zlogin: hand ZDOTDIR back now.
if [[ ! -o login ]]; then ZDOTDIR="$WT_USER_ZDOTDIR"; unset WT_INT_ZDOTDIR WT_USER_ZDOTDIR; fi
