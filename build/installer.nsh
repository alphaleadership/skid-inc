; Custom NSIS installer script for Skid-Inc

; Add custom installer pages
!macro customInstall
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\Skid-Inc.lnk" "$INSTDIR\Skid-Inc.exe"
  
  ; Create start menu shortcut
  CreateDirectory "$SMPROGRAMS\Skid-Inc"
  CreateShortCut "$SMPROGRAMS\Skid-Inc\Skid-Inc.lnk" "$INSTDIR\Skid-Inc.exe"
  CreateShortCut "$SMPROGRAMS\Skid-Inc\Uninstall Skid-Inc.lnk" "$INSTDIR\Uninstall Skid-Inc.exe"
!macroend

!macro customUnInstall
  ; Remove desktop shortcut
  Delete "$DESKTOP\Skid-Inc.lnk"
  
  ; Remove start menu shortcuts
  Delete "$SMPROGRAMS\Skid-Inc\Skid-Inc.lnk"
  Delete "$SMPROGRAMS\Skid-Inc\Uninstall Skid-Inc.lnk"
  RMDir "$SMPROGRAMS\Skid-Inc"
!macroend

; Custom header for installer
!macro customHeader
  !system "echo 'Building Skid-Inc installer...'"
!macroend