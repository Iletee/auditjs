/*
 * Copyright (c) 2019-present Sonatype, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { OssIndexServerResult, Vulnerability } from '../Types/OssIndexServerResult';
import chalk from 'chalk';
import * as builder from 'xmlbuilder';

export class AuditOSSIndex {
  constructor(readonly quiet: boolean = false, readonly json: boolean = false, readonly xml: boolean = false) {}

  public auditResults(results: Array<OssIndexServerResult>): boolean {
    if (this.json) {
      return this.printJson(results);
    }
    if (this.xml) {
      return this.printJUnitXML(results);
    }

    const total = results.length;
    results = results.sort((a, b) => {
      return a.coordinates < b.coordinates ? -1 : 1;
    });

    console.log();
    console.group();
    this.printLine('Sonabot here, beep boop beep boop, here are your Sonatype OSS Index results:');
    this.suggestIncludeDevDeps(total);
    console.groupEnd();
    console.log();

    this.printLine('-'.repeat(process.stdout.columns));

    let isVulnerable = false;

    results.forEach((x: OssIndexServerResult, i: number) => {
      if (x.vulnerabilities && x.vulnerabilities.length > 0) {
        isVulnerable = true;
        this.printVulnerability(i, total, x);
      } else {
        this.printLine(chalk.keyword('green')(`[${i + 1}/${total}] - ${x.toAuditLog()}`));
      }
    });

    this.printLine('-'.repeat(process.stdout.columns));

    return isVulnerable;
  }

  private printJson(results: Array<OssIndexServerResult>): boolean {
    console.log(JSON.stringify(results, null, 2));

    if (this.getNumberOfVulnerablePackagesFromResults(results) > 0) {
      return true;
    }
    return false;
  }

  private printJUnitXML(results: Array<OssIndexServerResult>): boolean {
    const testsuite = builder.create('testsuite');
    testsuite.att('tests', results.length);
    testsuite.att('timestamp', new Date().toISOString());
    testsuite.att('failures', this.getNumberOfVulnerablePackagesFromResults(results));

    for (let i = 0; i < results.length; i++) {
      const testcase = testsuite.ele('testcase', { classname: results[i].coordinates, name: results[i].coordinates });
      const vulns = results[i].vulnerabilities;

      if (vulns) {
        if (vulns.length > 0) {
          const failure = testcase.ele('failure');
          let failureText = '';
          for (let j = 0; j < vulns.length; j++) {
            failureText += this.getVulnerabilityForXmlBlock(vulns[j]) + '\n';
          }
          failure.text(failureText);
          failure.att('type', 'Vulnerability detected');
        }
      }
    }

    const xml = testsuite.end({ pretty: true });

    console.log(xml);

    if (this.getNumberOfVulnerablePackagesFromResults(results) > 0) {
      return true;
    }
    return false;
  }

  private getNumberOfVulnerablePackagesFromResults(results: Array<OssIndexServerResult>): number {
    return results.filter((x) => {
      return x.vulnerabilities && x.vulnerabilities?.length > 0;
    }).length;
  }

  private getVulnerabilityForXmlBlock(vuln: Vulnerability): string {
    let vulnBlock = '';
    vulnBlock += `Vulnerability Title: ${vuln.title}\n`;
    vulnBlock += `ID: ${vuln.id}\n`;
    vulnBlock += `Description: ${vuln.description}\n`;
    vulnBlock += `CVSS Score: ${vuln.cvssScore}\n`;
    vulnBlock += `CVSS Vector: ${vuln.cvssVector}\n`;
    vulnBlock += `CVE: ${vuln.cve}\n`;
    vulnBlock += `Reference: ${vuln.reference}\n`;

    return vulnBlock;
  }

  private getColorFromMaxScore(maxScore: number, defaultColor = 'chartreuse'): string {
    if (maxScore > 8) {
      defaultColor = 'red';
    } else if (maxScore > 6) {
      defaultColor = 'orange';
    } else if (maxScore > 4) {
      defaultColor = 'yellow';
    }
    return defaultColor;
  }

  private printVulnerability(i: number, total: number, result: OssIndexServerResult): void {
    if (!result.vulnerabilities) {
      return;
    }
    const maxScore: number = Math.max(
      ...result.vulnerabilities.map((x: Vulnerability) => {
        return +x.cvssScore;
      }),
    );
    const printVuln = (x: Array<Vulnerability>): void => {
      x.forEach((y: Vulnerability) => {
        const color: string = this.getColorFromMaxScore(+y.cvssScore);
        console.group();
        console.log(chalk.keyword(color)(`Vulnerability Title: `), `${y.title}`);
        console.log(chalk.keyword(color)(`ID: `), `${y.id}`);
        console.log(chalk.keyword(color)(`Description: `), `${y.description}`);
        console.log(chalk.keyword(color)(`CVSS Score: `), `${y.cvssScore}`);
        console.log(chalk.keyword(color)(`CVSS Vector: `), `${y.cvssVector}`);
        console.log(chalk.keyword(color)(`CVE: `), `${y.cve}`);
        console.log(chalk.keyword(color)(`Reference: `), `${y.reference}`);
        console.log();
        console.groupEnd();
      });
    };

    console.log(
      chalk.keyword(this.getColorFromMaxScore(maxScore)).bold(`[${i + 1}/${total}] - ${result.toAuditLog()}`),
    );
    console.log();
    result.vulnerabilities &&
      printVuln(
        result.vulnerabilities.sort((x, y) => {
          return +y.cvssScore - +x.cvssScore;
        }),
      );
  }

  private printLine(line: any): void {
    if (!this.quiet) {
      console.log(line);
    }
  }

  private suggestIncludeDevDeps(total: number) {
    this.printLine(`Total dependencies audited: ${total}`);
    if (total == 0) {
      this.printLine(
        `We noticed you had 0 dependencies, we exclude devDependencies by default, try running with --dev if you want to include those as well`,
      );
    }
  }
}
