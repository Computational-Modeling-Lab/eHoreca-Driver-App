import { Component } from '@angular/core';

import { Platform } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';
import { TranslateService } from '@ngx-translate/core';
import { InfoSendService } from './services/info-send.service';
import { Network } from '@capacitor/network';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss']
})
export class AppComponent {
  constructor(
    private platform: Platform,
    private splashScreen: SplashScreen,
    private statusBar: StatusBar,
    private translate: TranslateService,
    private sendSvc: InfoSendService
  ) {
    this.translate.setDefaultLang('gr');
    this.initializeApp();
  }

  async handledStoredRoute ():Promise<void> {
    const storedRoute = await this.sendSvc.retrieveStoredRoute();
    if (!storedRoute) return;
    console.log('storedRoute:', storedRoute);
    const status = await Network.getStatus();
    if (status && status.connected) {
      this.sendSvc.sendRoute(
        storedRoute.routeId,
        storedRoute.routeData,
        storedRoute.vehicleId,
        storedRoute.lastBinId
      );
    } else {
      this.sendSvc.sendOnNetworkListener();
    }
  }

  async initializeApp() {
    this.platform.ready().then(() => {
      this.statusBar.styleDefault();
      this.splashScreen.hide();
    });
    try {
      await this.handledStoredRoute();
    } catch (error) {
      console.log('handle stored route error:', error);
    }
  }
}
