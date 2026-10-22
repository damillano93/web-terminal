ZDOTDIR="$WT_USER_ZDOTDIR"
# macOS's /etc/zshrc ran with ZDOTDIR still pointing here and set
# HISTFILE=$ZDOTDIR/.zsh_history: history must go to the user's file.
[[ "$HISTFILE" == "$WT_INT_ZDOTDIR/.zsh_history" ]] && HISTFILE="$ZDOTDIR/.zsh_history"
[[ -f "$ZDOTDIR/.zshrc" ]] && source "$ZDOTDIR/.zshrc"
ZDOTDIR="$WT_INT_ZDOTDIR"
source "$WT_INT_ZDOTDIR/integration.zsh"
# A non-login shell reads no .zlogin: hand ZDOTDIR back now.
if [[ ! -o login ]]; then ZDOTDIR="$WT_USER_ZDOTDIR"; unset WT_INT_ZDOTDIR WT_USER_ZDOTDIR; fi
