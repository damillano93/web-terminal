# Tells the web-terminal where the shell is and what it is doing, with
# invisible escape sequences that any other terminal simply ignores:
#   OSC 7            current directory (new tabs open there)
#   OSC 133;A        prompt start (Cmd+↑/↓ jumps between prompts)
#   OSC 133;C;cmd=…  a command started (its first word names the tab)
#   OSC 133;D;<code> it finished, with its exit status (tab ✓/✗, notifications)
[[ -n $WT_INTEGRATION_LOADED ]] && return
WT_INTEGRATION_LOADED=1

__wt_urlencode() {
  emulate -L zsh
  local LC_ALL=C s="$1" out="" c i
  for (( i = 1; i <= ${#s}; i++ )); do
    c=${s[i]}
    case $c in
      [a-zA-Z0-9/._~-]) out+=$c ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  print -rn -- "$out"
}

__wt_precmd() {
  local ec=$?
  if [[ -n $__wt_running ]]; then
    printf '\e]133;D;%s\a' "$ec"
    __wt_running=
  fi
  printf '\e]7;file://%s%s\a' "${HOST}" "$(__wt_urlencode "$PWD")"
  printf '\e]133;A\a'
}

__wt_preexec() {
  __wt_running=1
  local cmd=${1%% *}
  cmd=${cmd##*/}
  printf '\e]133;C;cmd=%s\a' "$(__wt_urlencode "$cmd")"
}

autoload -Uz add-zsh-hook
# First in line, so $? is still the command's own exit status.
precmd_functions=(__wt_precmd ${precmd_functions:#__wt_precmd})
add-zsh-hook preexec __wt_preexec
