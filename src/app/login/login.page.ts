import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LoadingController } from '@ionic/angular';

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
  plateRegEx: RegExp;
  invalidPlate: boolean = false;
  vehicleError: boolean = false;
  noVehicleError: boolean = false;
  routeError: boolean = false;
  noRouteError: boolean = false;
  otherError: boolean = false;
  selectedLanguage: string;

  constructor(
    private http: HttpClient,
    private constants: ConstantsService,
    private loadingctrl: LoadingController,
    private router: Router,
    public translate: TranslateService,
    public sendSvc: InfoSendService
  ) {
    this.plateRegEx = new RegExp(/[A-ZΑ-Ω]{3}[0-9]{4}/gi);
    this.url = this.constants.apiURL;
  }

  async getVehicle() {
    this.invalidPlate = false;
    this.vehicleError = false;
    this.noVehicleError = false;
    this.routeError = false;
    this.noRouteError = false;
    this.otherError = false;

    const plate = this.plate.toUpperCase();

    const loading = await this.loadingctrl.create(
      { message: `${this.translate.instant('COMMON.GETTINGDATA')}...<br>${this.translate.instant('COMMON.PLEASEWAIT')}` }
    );
    await loading.present();

    if (!this.plateRegEx.test(plate)) {
      this.invalidPlate = true;
      this.plate = "";
      await loading.dismiss();
      return;
    }

    const networkStatus = await Network.getStatus();
    if (!networkStatus.connected) {
      this.otherError = true;
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
          if (err.error.message === "Vehicle id not found")
            this.noVehicleError = true;
          else
            this.vehicleError = true;
          await loading.dismiss();
          console.error(JSON.stringify(err));
        }
      );
  }

  getRoute(loading) {
    this.http.get<any>(`${this.url}/routes/vehicle/${this.vehicle.id}`)
      .subscribe(
        async data => {
          this.route = data.data;
          await loading.dismiss();
          this.continue();
        },
        async err => {
          if (err.error.message === "Vehicle has no route")
            this.noRouteError = true;
          else
            this.routeError = true;

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
    console.log('ngOnInit:');
    this.selectedLanguage = await (await Storage.get({ key: "language" })).value;
    if (this.selectedLanguage) this.translate.use(this.selectedLanguage);
  }
}
