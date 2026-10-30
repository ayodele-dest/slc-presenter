!macro customInstall
  DetailPrint "Configuring SLC Network Output..."
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="SLC Presenter Network Output"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall add rule name="SLC Presenter Network Output" description="Allows authenticated SLC Presenter receiver connections from the local network." dir=in action=allow protocol=TCP localport=43127 profile=any enable=yes'
  Pop $0
!macroend

!macro customUnInstall
  DetailPrint "Removing SLC Network Output firewall rule..."
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="SLC Presenter Network Output"'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\netsh.exe" advfirewall firewall delete rule name="SLC_Presenter_Network_Output"'
  Pop $0
!macroend
