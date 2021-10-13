import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ConstantsService } from './constants/constants.service';
import { Storage } from '@capacitor/storage';
import { Network } from '@capacitor/network';
import { StoredData } from '../home/Models/models';

@Injectable({
  providedIn: 'root'
})
export class InfoSendService {
  storeRouteExists: boolean;

  constructor(
    private loadingctrl: LoadingController,
    private http: HttpClient,
    private alertctrl: AlertController,
    private router: Router,
    private translate: TranslateService,
    private constants: ConstantsService,
  ) { }


  async storeDataForLater(routeId, routeData, vehicleId, lastBinId): Promise<void> {
    alert(`${this.translate.instant('SERVICES.NOINTERNET')}`);
    const body: StoredData = {
      routeId,
      routeData,
      vehicleId,
      lastBinId
    }
    Storage.set({key: 'storedRoute', value:JSON.stringify(body)});
    Network.removeAllListeners();
    this.sendOnNetworkListener();
    this.storeRouteExists = true;
  }

  async retrieveStoredRoute (): Promise<StoredData> {
    try {
      const { value } = await Storage.get({key: 'storedRoute'});
      if ( value ) {
        this.storeRouteExists = true;
        return JSON.parse(value);
      }
      else return;
    } catch (error) {
      console.log('get route error:', error);
    }
  }

  async sendStoredRoute(): Promise<void> {
    try {
      const body = await this.retrieveStoredRoute();
      console.log('body to send:', body);
      alert(`${this.translate.instant('SERVICES.SENDSTORED')}`);
      await this.sendRoute(body.routeId, body.routeData, body.vehicleId, body.lastBinId);
    } catch (error) {
      console.log('error sending stored route:', error);
    }
  }

  sendOnNetworkListener () {
    Network.addListener(
      'networkStatusChange', async ()=> {
        const status = await Network.getStatus();
        if (status && status.connected) {
          Network.removeAllListeners();
          await this.sendStoredRoute();
        }
      }
    )
  }

  async sendRoute (routeId, routeData, vehicleId, lastBinId): Promise<void> {
    console.log('lastBinId:', lastBinId);
    console.log('routeData:', routeData);
    console.log('routeId:', routeId);
    console.log('vehicleId:', vehicleId);
    let loading;
    try {
      loading = await this.loadingctrl.create({ message: `${this.translate.instant('PAGES.HOME.UPLOADINGRESULTS')}...<br>${this.translate.instant('COMMON.PLEASEWAIT')}...` });
      await loading.present();
      await this.http.put<any>(`${this.constants.apiURL}/routes/${routeId}`, {
        outcome: routeData
      }, {
        responseType: 'text' as 'json'
      }).toPromise()

      await this.http.post<any>(`${this.constants.apiURL}/routes/completed/${routeId}`, {
        vehicle_id: vehicleId,
        bin_id: lastBinId,
      }, {
        responseType: 'text' as 'json'
      }).toPromise()
      Network.removeAllListeners();
      this.storeRouteExists = false;
      await loading.dismiss();
      const alert = await this.alertctrl.create({
        header: `${this.translate.instant('COMMON.SUCCESS')}`,
        message: `${this.translate.instant('PAGES.HOME.SUCCESSROUTE')}`,
        buttons: [
          {
            text: `${this.translate.instant('COMMON.DISMISS')}`,
            handler: async () => {
              await Storage.remove({key: 'storedRoute'});
              await Storage.remove({key: 'route'});
              this.router.navigate(['/']);
            }
          }
        ]
      })
      alert.present();
    }
    catch (err) {
      if (loading) await loading.dismiss();
      const alert = await this.alertctrl.create(
        {
          header: `${this.translate.instant('COMMON.ERROR')}!`,
          message: `${this.translate.instant('PAGES.HOME.ERRORUPLOADROUTE')}`,
          buttons: [
            {
              text: `${this.translate.instant('COMMON.DISMISS')}`,
            }
          ]
        }
      )
      alert.present();
      console.error(JSON.stringify(err));
    }
  }
  
}
