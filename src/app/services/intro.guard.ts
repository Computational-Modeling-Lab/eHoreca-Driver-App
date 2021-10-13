import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Storage } from '@capacitor/storage';
import { Network } from '@capacitor/network';


@Injectable({
  providedIn: 'root'
})
export class IntroGuard implements CanActivate {

  constructor(
    private router: Router,
  ) {}

  async canActivate(): Promise<boolean> {
    const language =  await (await Storage.get({ key: "language" })).value;
    if (language) {
      this.router.navigateByUrl('/login');
      return false;
    } else {
      return true;
    }
  } 

}
