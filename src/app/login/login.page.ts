import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AlertController, LoadingController } from '@ionic/angular';

import { ConstantsService } from '../services/constants/constants.service';

import { Storage } from '@capacitor/storage';
import { Network } from '@capacitor/network';
import { TranslateService } from '@ngx-translate/core';
import { InfoSendService } from '../services/info-send.service';
@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  url: string;
  plate: string = "";
  vehicle: any;
  route: any;
  selectedLanguage: string;

  constructor(
    private http: HttpClient,
    private constants: ConstantsService,
    private loadingctrl: LoadingController,
    private router: Router,
    public translate: TranslateService,
    public sendSvc: InfoSendService,
    private alertcontroller: AlertController,
  ) {
    this.url = this.constants.apiURL;
  }

  // Present an alert with options to the user.
  async presentAlert(
    header: string,
    message: string,
    buttons = [
      { text: 'Ok', handler: () => { } }
    ]
  ): Promise<void> { 
    const alert = await this.alertcontroller.create({
      header,
      message,
      backdropDismiss: false,
      buttons,
    });
    await alert.present();
  }

  sanitizePlate(plate: string): boolean { 
    return new RegExp(/[A-ZΑ-Ω]{3}[0-9]{4}/gi).test(plate);
  }

  async getVehicle() {
    const plate = this.plate.toUpperCase();

    const loading = await this.loadingctrl.create(
      { message: `${this.translate.instant('COMMON.GETTINGDATA')}...<br>${this.translate.instant('COMMON.PLEASEWAIT')}` }
    );
    await loading.present();

    if (!this.sanitizePlate(plate)) {
      await this.presentAlert(
        this.translate.instant('COMMON.ERROR'),
        this.translate.instant('PAGES.LOGIN.INVALIDPLATE')
      );
      this.plate = "";
      await loading.dismiss();
      return;
    }

    const networkStatus = await Network.getStatus();
    if (!networkStatus.connected) {
      await this.presentAlert(
        this.translate.instant('PAGES.LOGIN.INFOPROBLEM'),
        this.translate.instant('PAGES.LOGIN.NOINTERNET')
      );
      this.plate = "";
      await loading.dismiss();
      return;
    }

    this.http.get<any>(`${this.url}/vehicles/plate/${plate}`)
      .subscribe(
        data => {
          this.vehicle = data.data;
          this.getRoute(loading);
        },
        async err => {
          this.plate = "";
          if (err.error.message === "Vehicle id not found")
            await this.presentAlert(
              this.translate.instant('COMMON.ERROR'),
              this.translate.instant('PAGES.LOGIN.NOVEHICLE')
            );
          else
          await this.presentAlert(
            this.translate.instant('COMMON.ERROR'),
            this.translate.instant('PAGES.LOGIN.PLATEINFO')
          );
          await loading.dismiss();
          console.error(err);
        }
      );
  }

  getRoute(loading) {
    this.http.get<any>(`${this.url}/routes/vehicle/${this.vehicle.id}`)
      .subscribe(
        async data => {
          this.route = data.data;
          console.log('this.route:', this.route);
          await loading.dismiss();
          this.continue();
        },
        async err => {
          if (err.error.message === "Vehicle has no route")
            await this.presentAlert(
              this.translate.instant('COMMON.ERROR'),
              this.translate.instant('PAGES.LOGIN.NOROUTES')
            );
          else
            await this.presentAlert(
              this.translate.instant('COMMON.ERROR'),
              this.translate.instant('PAGES.LOGIN.ROUTEINFO')
            );
          console.error(JSON.stringify(err));
          await loading.dismiss();
        }
      );
  }

  async continue() {
    await Storage.set({ key: "vehicle", value: JSON.stringify(this.vehicle) });
    await Storage.set({ key: "route", value: JSON.stringify(this.route) });

    this.router.navigate(['/home']);
  }

  async setLanguage (language: string): Promise<void> {
    this.translate.use(language);
    await Storage.set({ key: "language", value: language });
  }


  async ngOnInit (): Promise<void> {
    this.selectedLanguage = await (await Storage.get({ key: "language" })).value;
    if (this.selectedLanguage) this.translate.use(this.selectedLanguage);
  }
}
