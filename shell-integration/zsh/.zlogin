ZDOTDIR="$WT_USER_ZDOTDIR"
[[ -f "$ZDOTDIR/.zlogin" ]] && source "$ZDOTDIR/.zlogin"
# From here on (and in any shell started from this one) ZDOTDIR is the user's.
unset WT_INT_ZDOTDIR WT_USER_ZDOTDIR
