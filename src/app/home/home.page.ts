import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ModalController, LoadingController, AlertController, NavController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { Geolocation, Geoposition, PositionError } from '@ionic-native/geolocation/ngx';
import { DeviceOrientation, DeviceOrientationCompassHeading } from '@ionic-native/device-orientation/ngx';
import { Network } from '@capacitor/network';
import { ConstantsService } from '../services/constants/constants.service';
import { BinReportPage } from './bin-report/bin-report.page';
import { Storage } from '@capacitor/storage';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { InfoSendService } from '../services/info-send.service';
import { Insomnia } from '@ionic-native/insomnia/ngx';
import { registerPlugin } from '@capacitor/core';
import { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

interface Point {
  lat: number;
  lng: number;
}
declare var google;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('map') mapElement: ElementRef;
  map: any;
  currentPosMarker: any;
  icon: any;
  latlng: { lat: number, lng: number } = { lat: 0, lng: 0 };
  mapCoords: any;
  currentRotation: number;
  isLightMode: boolean = true;
  switchToMode: string = "dark";
  iconLocation: string = "https://ehoreca.cmodlab-iu.edu.gr/images/markers/";
  url: string;
  vehicle: any;
  route: any;
  bins: [any] = <any>[];
  binMarkers: [any] = <any>[];
  binMarkersCoords: [any] = <any>[];
  lastPickedBin: number = -1;
  watchPositionSub: Subscription;
  vehicleId;
  lastCompletedBinId;
  routeData: {} = {};

  myPath:Point[] = [];
  myPathPolyline;
  polyline: any;
  watchLocationId: string;
  pauseSub: Subscription;
  resumeSub: Subscription;

  constructor(
    private geolocation: Geolocation,
    private platform: Platform,
    private deviceOrientation: DeviceOrientation,
    private constants: ConstantsService,
    private modalctrl: ModalController,
    private loadingctrl: LoadingController,
    private http: HttpClient,
    private alertctrl: AlertController,
    private router: Router,
    public translate: TranslateService,
    private sendSvc: InfoSendService,
    private navCtrl: NavController,
    private insomnia: Insomnia,
  ) {
    this.url = this.constants.apiURL;

    this.icon = {
      path: this.constants.svgPath,
      fillColor: 'black',
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: 'black',
      anchor: new google.maps.Point(300, 300),
      scale: 0.05,
      rotation: 0,
    }
  }

  async ngOnInit() {
    let loading;
    try {
      await this.platform.ready();
      loading = await this.initRoute();
      await this.loadMap();
      await loading.dismiss();
      await this.insomnia.keepAwake();
      this.bgGeolocation();
    } catch (error) {
      await loading.dismiss();
      // const alert = await this.alertctrl.create(
      //   {
      //     header: `${this.translate.instant('COMMON.ERROR')}!`,
      //     message: `${this.translate.instant('PAGES.HOME.ERRORONROUTE')}`,
      //     buttons: [
      //       {
      //         text: `${this.translate.instant('COMMON.BACK')}`,
      //         handler: () => { this.router.navigate(['/']); }
      //       }
      //     ]
      //   }
      // )
      // alert.present();
    }
  }

  async ngOnDestroy() {
    if (this.watchPositionSub) this.watchPositionSub.unsubscribe();
    await BackgroundGeolocation.removeWatcher({
      id: this.watchLocationId
    });
    await this.insomnia.allowSleepAgain();
    if (this.pauseSub) this.pauseSub.unsubscribe();
    if (this.resumeSub) this.resumeSub.unsubscribe();
  }

  // Listeners for the app foreground-background state
  backgroundSubscriptions (): void {
    this.pauseSub = this.platform.pause.subscribe(
      (data) => {
        this.stopActivity();
      }
    )
    this.resumeSub = this.platform.resume.subscribe(
      async (data) => {
        this.bgGeolocation();
      }
    )
  }

  async stopActivity(): Promise<void> {
    if (this.watchLocationId) {
      try {
        await BackgroundGeolocation.removeWatcher({
          id: this.watchLocationId
        });
        this.watchLocationId = undefined;
      } catch (error) {
        alert(error);
      }
    }
  }

  bgGeolocation (): void {
    BackgroundGeolocation.addWatcher({
          requestPermissions: true,
          stale: false,
          distanceFilter: 0.5
      },
      async (location, error) => {
        if (error) {
          if (error.code === "NOT_AUTHORIZED") {
              if (window.confirm(
                  "This app needs your location, " +
                  "but does not have permission.\n\n" +
                  "Open settings now?"
              )) {
                  BackgroundGeolocation.openSettings();
              }
          }
          return console.error(error);
        }
          if (location) {
            if(location.accuracy < 50) this.updatePosition(location);
          }
        console.log(location);
      },
    ).then(
      (watcher_id) => {
        this.watchLocationId = watcher_id;
      });
  }

  async initRoute() {
    try {
      const loading = await this.loadingctrl.create({ message: `${this.translate.instant('PAGES.HOME.LOADINGROUTE')}...<br>${this.translate.instant('COMMON.PLEASEWAIT')}...` });
      await loading.present();
  
      await Storage.get({ key: "vehicle" }).then(vehicle => { this.vehicle = JSON.parse(vehicle.value) });
      await Storage.get({ key: "route" }).then(route => { this.route = JSON.parse(route.value) });
  
      if (this.vehicle && this.route) {
        // get bins for route
        await this.route.bins.forEach(async binId => {
          this.http.get<any>(`${this.url}/bins/${binId}`)
            .subscribe(
              data => {
                this.bins.push(data);
              },
              err => {
                console.error(JSON.stringify(err));
              }
            )
        });
        this.vehicleId = this.vehicle.id;
        this.routeData['info'] =
        {
          route_id: this.route.id,
          vehicle_id: this.vehicle.id,
          bin_count: this.bins.length,
          bin_list: this.route.bins,
        };
        return Promise.resolve(loading);
      }
      else {
        loading.dismiss()
        return Promise.reject();
      }
    } catch (error) {
      console.log('error:', error);
    }

  }

  async loadMap() {
    await this.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 }).then((resp: any) => {
      this.latlng.lat = resp.coords.latitude;
      this.latlng.lng = resp.coords.longitude;
      this.mapCoords = new google.maps.LatLng(resp.coords.latitude, resp.coords.longitude);
      this.map = new google.maps.Map(this.mapElement.nativeElement, this.getMapOptions());
      this.currentPosMarker = new google.maps.Marker(
        {
          position: this.mapCoords,
          map: this.map,
          clickable: false,
          dragable: false,
          icon: this.icon,
        });
    });

    this.addMarkers();
  }

  async addMarkers() {
    if (this.bins.length < this.route.bins.length) {
      this.binMarkers = <any>[];
      this.binMarkersCoords = <any>[];

      return setTimeout(() => this.addMarkers(), 1000)
    }

    await this.bins.forEach(async bin => {
      const binMarker = await this.binMarkerController(bin);
      this.binMarkers.push(binMarker);

      this.binMarkersCoords.push(
        {
          'lat': parseFloat(bin.location.lat),
          'lng': parseFloat(bin.location.lng),
        }
      );
    });

    this.binMarkersCoords.unshift(this.mapCoords)

    // polyline
    this.polyline = new google.maps.Polyline(
      {
        path: this.binMarkersCoords,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 0.75,
        strokeWeight: 1,
        map: this.map
      }
    );
  }

  drawPolygon (path: Point[]): void {
    if (this.myPathPolyline) this.myPathPolyline.setMap(null);

    this.myPathPolyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#4582FB',
      strokeOpacity: 0.75,
      strokeWeight: 1,
      map: this.map
    });
  }

  async updatePosition(resp) {
    console.log('resp:', resp);
    if (this.platform.is('hybrid'))
      this.currentRotation = await this.deviceOrientation.getCurrentHeading().then((data: DeviceOrientationCompassHeading) => {
        return data.magneticHeading;
      });

    this.latlng.lat = resp.latitude;
    this.latlng.lng = resp.longitude;

    this.mapCoords = new google.maps.LatLng(resp.latitude, resp.longitude);
    this.map.panTo(this.mapCoords);
    this.currentPosMarker.setPosition(this.mapCoords);
    this.icon.rotation = this.currentRotation;
    this.currentPosMarker.setIcon(this.icon);
    this.binMarkersCoords[0] = this.mapCoords;
    this.myPath.push({lat: resp.latitude, lng: resp.longitude});
    this.drawPolygon(this.myPath);
  }

  getMapOptions() {
    var mapOptions =
    {
      center: this.mapCoords,
      zoom: 19,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      scaleControl: false,
      streetViewControl: false,
      mapTypeControl: true,
      mapTypeControlOptions:
      {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
      },
      fullscreenControl: false,
    }

    if (!this.isLightMode)
      mapOptions['styles'] = this.constants.mapDarkTheme;

    return mapOptions;
  }

  binMarkerController(bin) {
    const binLocation = new google.maps.LatLng(bin.location.lat, bin.location.lng);

    let icon = this.iconLocation;
    switch (bin.type) {
      case 'compost':
        icon += "waste_container_yellow.vsmall.png";
        break;
      case 'glass':
        icon += "waste_container_blue.vsmall.png";
        break;
      case 'recyclable':
        icon += "waste_container_blue.vsmall.png";
        break;
      case 'mixed':
        icon += "waste_container_green.vsmall.png";
        break;
      case 'metal':
        icon += "waste_container_blue.vsmall.png";
        break;
      case 'paper':
        icon += "waste_container_yellow.vsmall.png";
        break;
      case 'plastic':
        icon += "waste_container_blue.vsmall.png";
        break;
    }

    return new google.maps.Marker(
      {
        position: binLocation,
        icon: icon,
        map: this.map,
        title: "Bin"
      });
  }

  switchLightDarkMode() {
    this.icon.fillColor = this.isLightMode ? "white" : "black";
    this.switchToMode = this.isLightMode ? "light" : "dark";
    this.isLightMode = !this.isLightMode;
    this.loadMap();
  }

  async binPickup() {
    const modal = await this.modalctrl.create({
      component: BinReportPage,
      backdropDismiss: false,
      componentProps: {
        coords: this.latlng,  // current location
        bin: this.bins[this.lastPickedBin + 1], // the next bin to pick up
      }
    })
    await modal.present();
    const data: any = await modal.onDidDismiss();
    if (data.data.confirm) {
      data.data.bin_data.lat = this.latlng.lat;
      data.data.bin_data.lng = this.latlng.lng;

      this.lastPickedBin += 1;
      this.routeData[`Bin_${this.lastPickedBin}`] = data.data.bin_data;
      this.binMarkersCoords.splice(1, 1);
      this.polyline = new google.maps.Polyline({
        path: this.binMarkersCoords,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 0.75,
        strokeWeight: 1,
        map: this.map
      });
    }
  }

  async endRoute() {
    try {
      if(this.lastPickedBin<0) {
        let confirm;
        const alert = await this.alertctrl.create({
          header: `${this.translate.instant('COMMON.WARNING')}`,
          message: `${this.translate.instant('PAGES.HOME.NOBINSPICKED')}`,
          buttons: [
            {
              text: `${this.translate.instant('COMMON.CONFIRM')}`,
              handler: async () => {
                confirm = true;
                await Storage.remove({key: 'route'});
                this.navCtrl.back();
              }
            },
            {
              text: `${this.translate.instant('COMMON.CANCEL')}`,
              handler: async () => {
                confirm = false;
              }
            }
          ]
        })
        await alert.present();
        return;
      }

      const hasInternet = await (await Network.getStatus()).connected;
      console.log('hasInternet:', hasInternet);
      if (!hasInternet) {
        this.sendSvc.storeDataForLater(this.route.id, this.routeData, this.vehicleId, this.bins[this.lastPickedBin].id);
        this.navCtrl.back();
        return console.log('no internet');
      }
      await this.sendSvc.sendRoute(this.route.id, this.routeData, this.vehicleId, this.bins[this.lastPickedBin].id );
    }
    catch (err) {
      console.log('err:', err);
    }
  }
}
