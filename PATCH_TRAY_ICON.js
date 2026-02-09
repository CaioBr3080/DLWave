// Função para criar o tray icon - VERSÃO CORRIGIDA
function createTray() {
  // Carregar o ícone do arquivo assets/tray-icon.png
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const trayIconPath = isDev 
    ? path.join(process.cwd(), 'assets', 'tray-icon.png')
    : path.join(path.dirname(app.getPath('exe')), 'resources', 'assets', 'tray-icon.png');
  
  let icon;
  if (fs.existsSync(trayIconPath)) {
    console.log('✓ Carregando ícone do tray de:', trayIconPath);
    icon = nativeImage.createFromPath(trayIconPath);
    // Redimensionar para 16x16 (tamanho esperado pela bandeja do Windows)
    icon = icon.resize({ width: 16, height: 16 });
  } else {
    console.log('✗ Arquivo tray-icon.png não encontrado em:', trayIconPath);
    console.log('  Usando ícone fallback base64');
    // Fallback: ícone base64 se não encontrar o arquivo
    const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADlSURBVDiNpdMxSwJhHMfxz+NxehYEDdIWBS0NDU3R0BAN0RAN0RAN0dAQLdHQ0BAt0dAQLdEQRUND0NAQDdHQ0BAN0RAN0RAN0dIi3RBFnedc/ODh/8A/+PJ7nnsuIiICYA/YBzaAGWAUGADagC7QAVpAA3gAngADuAeugEvgDDgBjoEj4BA4AA6AfeA3sAfsAr+AXWAHiAE7wDYQBbaAKLAJbABrwCqwAiwDy8ASsAgsAAvAPDAPzAFzwCwwA0wD08AUMA1MApPABDAOjAFjwCgwAowAw8AQMAiEgQFgAOgH+oA+oA/oA/qAPqAvcA/4A1p8qQlnEvjAAAAAElFTkSuQmCC';
    icon = nativeImage.createFromDataURL(iconData);
  }
  
  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🌊 Mostrar DLWave',
      click: () => {
        if (mainWindowGlobal) {
          mainWindowGlobal.show();
          mainWindowGlobal.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('DLWave');
  tray.setContextMenu(contextMenu);
  
  // Duplo clique ou clique simples para restaurar
  tray.on('click', () => {
    if (mainWindowGlobal) {
      if (mainWindowGlobal.isVisible()) {
        mainWindowGlobal.hide();
      } else {
        mainWindowGlobal.show();
        mainWindowGlobal.focus();
      }
    }
  });
  
  tray.on('double-click', () => {
    if (mainWindowGlobal) {
      mainWindowGlobal.show();
      mainWindowGlobal.focus();
    }
  });
}
